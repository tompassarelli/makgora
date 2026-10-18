use std::fs::{self, DirBuilder};
use std::io::ErrorKind;
use std::os::unix::fs::DirBuilderExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::private_desktop::{has_wayland, is_owned, is_run_directory};
use crate::process::{exit_code, output, spawn_failure, substituted};
use crate::screen_state::ScreenState;
use crate::stop::{Outcome, Stop};

const USAGE: &str = "Usage: smashcraft-tools wc3-wait-state RUN_DIR EXPECTED_STATE TIMEOUT_SECONDS";
const TIMED_OUT: u8 = 124;
const PAUSE: Duration = Duration::from_millis(100);

pub struct Attempt {
    pub code: u8,
    pub stdout: String,
}

pub trait Probe {
    fn now(&self) -> Instant;
    fn capture(&mut self, frame: &Path, limit: &str) -> Result<Attempt, Stop>;
    fn observe(&mut self, frame: &Path, limit: &str) -> Result<Attempt, Stop>;
    fn pause(&mut self);
}

struct Desktop {
    run_directory: PathBuf,
    launcher: PathBuf,
    observer: PathBuf,
}

impl Probe for Desktop {
    fn now(&self) -> Instant {
        Instant::now()
    }

    fn capture(&mut self, frame: &Path, limit: &str) -> Result<Attempt, Stop> {
        let mut capture = Command::new("timeout");
        capture
            .arg(limit)
            .arg(&self.launcher)
            .arg("capture")
            .args([&self.run_directory, frame])
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        let status = capture
            .status()
            .map_err(|error| spawn_failure(&capture, error))?;
        Ok(Attempt {
            code: exit_code(status),
            stdout: String::new(),
        })
    }

    fn observe(&mut self, frame: &Path, limit: &str) -> Result<Attempt, Stop> {
        let mut observe = Command::new("timeout");
        observe
            .arg(limit)
            .arg(&self.observer)
            .arg("wc3-screen-state")
            .arg(frame)
            .stderr(Stdio::inherit());
        let output = observe
            .output()
            .map_err(|error| spawn_failure(&observe, error))?;
        Ok(Attempt {
            code: exit_code(output.status),
            stdout: substituted(&output.stdout),
        })
    }

    fn pause(&mut self) {
        thread::sleep(PAUSE);
    }
}

fn limit(probe: &impl Probe, deadline: Instant, expected: ScreenState) -> Result<String, Stop> {
    let centiseconds = deadline.saturating_duration_since(probe.now()).as_millis() / 10;
    if centiseconds == 0 {
        return Err(expired(expected));
    }
    Ok(format!("{}.{:02}s", centiseconds / 100, centiseconds % 100))
}

fn expired(expected: ScreenState) -> Stop {
    Stop::out(TIMED_OUT, format!("timeout: expected {}", expected.name()))
}

pub fn wait(
    probe: &mut impl Probe,
    frames: &Path,
    expected: ScreenState,
    budget: Duration,
) -> Result<String, Stop> {
    let deadline = probe.now() + budget;
    for count in 1.. {
        let window = limit(probe, deadline, expected)?;
        let frame = frames.join(format!("{count}.png"));
        if fs::symlink_metadata(&frame).is_ok() {
            return Err(Stop::silent(1));
        }
        let captured = probe.capture(&frame, &window)?;
        let window = limit(probe, deadline, expected)?;
        if captured.code == TIMED_OUT {
            return Err(expired(expected));
        }
        if captured.code != 0 || fs::metadata(&frame).map_or(true, |metadata| metadata.len() == 0) {
            return Err(Stop::out(1, "capture-failed"));
        }
        let observed = probe.observe(&frame, &window)?;
        limit(probe, deadline, expected)?;
        if observed.code == TIMED_OUT {
            return Err(expired(expected));
        }
        let state = observed.stdout;
        if observed.code != 0 {
            let shown = if state.is_empty() { "no-state" } else { &state };
            return Err(Stop::out(1, format!("observation-failed: {shown}")));
        }
        eprintln!("Observed: {state}");
        if state == ScreenState::Disconnected.name() {
            return Err(Stop::out(1, "blocked: disconnected"));
        }
        if state == expected.name() {
            return Ok(format!("ready: {state} capture={}", frame.display()));
        }
        if ScreenState::menu(&state).is_none() {
            return Err(Stop::out(1, format!("observation-failed: {state}")));
        }
        probe.pause();
    }
    Err(expired(expected))
}

fn unique_directory(parent: &Path) -> Result<PathBuf, Stop> {
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.subsec_nanos());
    for attempt in 0..100u32 {
        let suffix = format!(
            "{:06x}",
            (seed ^ std::process::id().rotate_left(attempt)).wrapping_add(attempt) & 0xff_ffff
        );
        let directory = parent.join(format!("wait-state.{suffix}"));
        match DirBuilder::new().mode(0o700).create(&directory) {
            Ok(()) => return Ok(directory),
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(Stop::err(
                    1,
                    format!("mktemp: {}: {error}", directory.display()),
                ));
            }
        }
    }
    Err(Stop::err(
        1,
        format!("mktemp: no unique directory under {}", parent.display()),
    ))
}

fn launcher() -> Result<PathBuf, Stop> {
    let skill = output(Command::new("agents").args(["path", "private-desktop-development"]))?;
    let directory = Path::new(&skill).parent().unwrap_or(Path::new("."));
    Ok(directory.join("scripts/private-desktop.sh"))
}

fn resolved(path: &Path) -> std::io::Result<PathBuf> {
    fs::canonicalize(path).or_else(|missing| match (path.parent(), path.file_name()) {
        (Some(parent), Some(name)) if missing.kind() == ErrorKind::NotFound => {
            let parent = if parent.as_os_str().is_empty() {
                Path::new(".")
            } else {
                parent
            };
            Ok(fs::canonicalize(parent)?.join(name))
        }
        _ => Err(missing),
    })
}

fn budget(text: &str) -> Option<Duration> {
    let digits =
        text.len() <= 3 && !text.starts_with('0') && text.bytes().all(|byte| byte.is_ascii_digit());
    let seconds: u64 = text.parse().ok().filter(|_| digits)?;
    (1..=120)
        .contains(&seconds)
        .then(|| Duration::from_secs(seconds))
}

pub fn cli(arguments: &[String]) -> Outcome {
    let [run_directory, expected, seconds] = arguments else {
        return Err(Stop::err(2, USAGE));
    };
    let run_directory = resolved(Path::new(run_directory))
        .map_err(|error| Stop::err(1, format!("realpath: {run_directory}: {error}")))?;
    if !is_run_directory(&run_directory.to_string_lossy()) {
        return Err(Stop::err(
            2,
            "Expected an exact private desktop run directory.",
        ));
    }
    if !(is_owned(&run_directory)
        && run_directory.join("active").is_file()
        && has_wayland(&run_directory))
    {
        return Err(Stop::err(1, "Private desktop is not live."));
    }
    let expected = ScreenState::menu(expected)
        .ok_or_else(|| Stop::err(2, "Unsupported expected menu state."))?;
    let budget = budget(seconds).ok_or_else(|| Stop::err(2, "Timeout must be 1..120 seconds."))?;
    let launcher = launcher()?;
    let observer = std::env::current_exe()
        .map_err(|error| Stop::err(1, format!("current executable: {error}")))?;
    let frames = unique_directory(&run_directory)?;
    eprintln!("Captures: {}", frames.display());
    let mut desktop = Desktop {
        run_directory,
        launcher,
        observer,
    };
    println!("{}", wait(&mut desktop, &frames, expected, budget)?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;
    use std::collections::VecDeque;

    use super::*;

    struct Scripted {
        start: Instant,
        clock: Cell<Duration>,
        step: Duration,
        states: VecDeque<(u8, &'static str)>,
        captures: u32,
    }

    impl Scripted {
        fn new(step_ms: u64, states: &[(u8, &'static str)]) -> Self {
            let states = states.iter().copied().collect();
            Self {
                start: Instant::now(),
                clock: Cell::new(Duration::ZERO),
                step: Duration::from_millis(step_ms),
                states,
                captures: 0,
            }
        }
    }

    impl Probe for Scripted {
        fn now(&self) -> Instant {
            self.start + self.clock.get()
        }

        fn capture(&mut self, frame: &Path, _: &str) -> Result<Attempt, Stop> {
            self.clock.set(self.clock.get() + self.step);
            self.captures += 1;
            fs::write(frame, b"png").map_err(|error| Stop::err(1, error.to_string()))?;
            Ok(Attempt {
                code: 0,
                stdout: String::new(),
            })
        }

        fn observe(&mut self, _: &Path, _: &str) -> Result<Attempt, Stop> {
            let (code, state) = self.states.pop_front().unwrap_or((0, "main-menu"));
            Ok(Attempt {
                code,
                stdout: state.to_owned(),
            })
        }

        fn pause(&mut self) {}
    }

    fn frames(name: &str) -> PathBuf {
        let directory = std::env::temp_dir().join(format!(
            "smashcraft-tools-wait-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir(&directory).unwrap();
        directory
    }

    fn verdict(result: Result<String, Stop>) -> Result<String, u8> {
        result.map_err(|stop| stop.code())
    }

    #[test]
    fn only_the_expected_menu_is_ready_and_other_menus_stay_pending() {
        let directory = frames("ready");
        let mut probe = Scripted::new(
            100,
            &[(0, "main-menu"), (0, "single-player"), (0, "create-game")],
        );
        let ready = verdict(wait(
            &mut probe,
            &directory,
            ScreenState::CreateGame,
            Duration::from_secs(5),
        ));
        assert_eq!(
            ready,
            Ok(format!(
                "ready: create-game capture={}",
                directory.join("3.png").display()
            ))
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn a_disconnect_or_an_unknown_screen_stops_at_once() {
        let directory = frames("blocked");
        let mut probe = Scripted::new(100, &[(0, "single-player"), (0, "disconnected")]);
        assert_eq!(
            verdict(wait(
                &mut probe,
                &directory,
                ScreenState::CreateGame,
                Duration::from_secs(5)
            )),
            Err(1)
        );
        fs::remove_dir_all(directory).unwrap();
        let directory = frames("unknown");
        let mut probe = Scripted::new(100, &[(1, "unknown")]);
        assert_eq!(
            verdict(wait(
                &mut probe,
                &directory,
                ScreenState::CreateGame,
                Duration::from_secs(5)
            )),
            Err(1)
        );
        assert_eq!(probe.captures, 1);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn elapsed_time_never_implies_readiness() {
        let directory = frames("expired");
        let mut probe = Scripted::new(400, &[]);
        assert_eq!(
            verdict(wait(
                &mut probe,
                &directory,
                ScreenState::CreateGame,
                Duration::from_secs(1)
            )),
            Err(TIMED_OUT)
        );
        assert_eq!(probe.captures, 3);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn a_missing_run_directory_resolves_like_realpath() {
        let missing = std::env::temp_dir().join("smashcraft-tools-absent-run");
        assert_eq!(
            resolved(&missing).unwrap(),
            fs::canonicalize(std::env::temp_dir())
                .unwrap()
                .join("smashcraft-tools-absent-run")
        );
        assert!(resolved(&missing.join("deeper")).is_err());
    }

    #[test]
    fn the_budget_accepts_only_one_to_one_hundred_twenty_seconds() {
        assert_eq!(budget("120"), Some(Duration::from_secs(120)));
        assert_eq!(budget("1"), Some(Duration::from_secs(1)));
        for refused in ["0", "121", "015", "1000", "", "+5", "5s"] {
            assert_eq!(budget(refused), None, "{refused}");
        }
    }
}
