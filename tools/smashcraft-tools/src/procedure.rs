use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

use crate::private_desktop::{has_wayland, is_run_directory};
use crate::process::{exit_code, find_program, project_root, spawn_failure, substituted};
use crate::stop::{Outcome, Stop};

const USAGE: &str = "\
Usage: smashcraft-tools wc3-procedure RUN_DIR STATE RECIPE
       smashcraft-tools wc3-procedure --validate STATE RECIPE
RUN_DIR is the exact private-desktop run directory. STATE is the caller's
asserted current game state. Procedures are short, named input chains. A sent
chain is never reported as game success; verify the resulting state yourself.";
const GAME_WINDOW: &str = "Warcraft III";
const ACTION_CAP_MS: u32 = 1500;
const ACTION_LIMIT: u32 = 40;
const SPAN_LIMIT_MS: u32 = 8000;

#[derive(Debug, PartialEq, Eq)]
pub struct Plan {
    pub caller_state: String,
    pub actions: Vec<String>,
    pub held: Vec<String>,
    pub count: u32,
    pub span_ms: u32,
}

fn invalid(text: impl Into<String>) -> Stop {
    Stop::err(2, text)
}

fn is_name(text: &str, longest: usize) -> bool {
    let mut characters = text.chars();
    characters
        .next()
        .is_some_and(|first| first.is_ascii_lowercase() || first.is_ascii_digit())
        && text.len() <= longest
        && characters.all(|rest| {
            rest.is_ascii_lowercase() || rest.is_ascii_digit() || rest == '_' || rest == '-'
        })
}

fn is_key(text: &str) -> bool {
    !text.is_empty()
        && text
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
}

fn milliseconds(text: &str) -> Option<u32> {
    let shaped = (1..=4).contains(&text.len())
        && !text.starts_with('0')
        && text.bytes().all(|byte| byte.is_ascii_digit());
    text.parse().ok().filter(|_| shaped)
}

fn delay(ms: u32) -> String {
    format!("{}.{:03}", ms / 1000, ms % 1000)
}

fn split_line(line: &str) -> (&str, &str, &str, &str) {
    let mut rest = line.trim_matches([' ', '\t']);
    let mut field = || {
        let end = rest.find([' ', '\t']).unwrap_or(rest.len());
        let (head, tail) = rest.split_at(end);
        rest = tail.trim_start_matches([' ', '\t']);
        head
    };
    let (op, argument, ms) = (field(), field(), field());
    (op, argument, ms, rest)
}

fn key_action<'a>(op: &str, argument: &'a str, ms: &str) -> Result<(Vec<&'a str>, u32), Stop> {
    let chord = op == "chord";
    let keys: Vec<&str> = if chord {
        argument.split('+').collect()
    } else {
        vec![argument]
    };
    let shaped = if chord {
        keys.len() == 2 && keys.iter().all(|key| is_key(key))
    } else {
        is_key(argument)
    };
    let ms = milliseconds(ms).filter(|_| shaped);
    let ms = ms.ok_or_else(|| {
        invalid(if chord {
            "Invalid chord action.".to_owned()
        } else {
            format!("Invalid {op} action.")
        })
    })?;
    if ms > ACTION_CAP_MS {
        return Err(invalid(if chord {
            "A chord is capped at 1500 ms."
        } else {
            "A key action is capped at 1500 ms."
        }));
    }
    if let Some(key) = keys.iter().find(|key| {
        matches!(
            key.to_lowercase().as_str(),
            "return" | "kp_enter" | "iso_enter" | "linefeed"
        )
    }) {
        return Err(invalid(format!(
            "Procedures never press {key}: outside a match it sends chat to Battle.net's channel or a lobby."
        )));
    }
    Ok((keys, ms))
}

impl Plan {
    fn push(&mut self, op: &str, argument: &str, ms: &str) -> Outcome {
        match op {
            "tap" | "hold" | "chord" => {
                let (keys, ms) = key_action(op, argument, ms)?;
                for key in &keys {
                    self.actions
                        .extend(["keydown".to_owned(), (*key).to_owned()]);
                    self.held.push((*key).to_owned());
                }
                self.actions.extend(["sleep".to_owned(), delay(ms)]);
                for key in keys.iter().rev() {
                    self.actions.extend(["keyup".to_owned(), (*key).to_owned()]);
                }
                self.span_ms += ms;
            }
            "wait" => {
                let ms = milliseconds(argument)
                    .filter(|_| ms.is_empty())
                    .ok_or_else(|| invalid("wait requires one duration in milliseconds."))?;
                if ms > ACTION_CAP_MS {
                    return Err(invalid("A wait is capped at 1500 ms."));
                }
                self.actions.extend(["sleep".to_owned(), delay(ms)]);
                self.span_ms += ms;
            }
            _ => return Err(invalid(format!("Unsupported recipe operation: {op}"))),
        }
        self.count += 1;
        Ok(())
    }
}

pub fn plan(chain: &str) -> Result<Plan, Stop> {
    let mut plan = Plan {
        caller_state: String::new(),
        actions: Vec::new(),
        held: Vec::new(),
        count: 0,
        span_ms: 0,
    };
    for line in chain.split('\n') {
        let (op, argument, ms, extra) = split_line(line);
        if op.is_empty() {
            continue;
        }
        if op.starts_with('#') {
            if op == "#" && argument == "caller-state" && plan.caller_state.is_empty() {
                plan.caller_state = ms.to_owned();
            }
            continue;
        }
        if !extra.is_empty() {
            return Err(invalid(format!(
                "Malformed recipe line: {op} {argument} {ms} {extra}"
            )));
        }
        plan.push(op, argument, ms)?;
        if plan.count > ACTION_LIMIT || plan.span_ms > SPAN_LIMIT_MS {
            return Err(invalid(
                "Procedure limit exceeded (40 actions / 8 seconds).",
            ));
        }
    }
    if plan.count == 0 {
        return Err(invalid("Procedure is empty."));
    }
    Ok(plan)
}

fn recipes() -> PathBuf {
    project_root().join("tools/wc3-procedures")
}

fn shell_quoted(text: &str) -> String {
    if text.is_empty() {
        return "''".to_owned();
    }
    text.chars()
        .flat_map(|character| {
            let plain = character.is_ascii_alphanumeric()
                || "_./,:@%^+=-".contains(character)
                || !character.is_ascii();
            (!plain).then_some('\\').into_iter().chain([character])
        })
        .collect()
}

struct Display {
    display: String,
    authority: String,
}

impl Display {
    fn read(run_directory: &Path) -> Result<Self, Stop> {
        let read = |name: &str| {
            fs::read(run_directory.join(name))
                .map(|bytes| substituted(&bytes))
                .map_err(|error| {
                    Stop::err(
                        1,
                        format!("{}: {error}", run_directory.join(name).display()),
                    )
                })
        };
        Ok(Self {
            display: read("display")?,
            authority: read("xauthority")?,
        })
    }

    fn xdotool(&self) -> Command {
        let mut command = Command::new("xdotool");
        command
            .env("DISPLAY", &self.display)
            .env("XAUTHORITY", &self.authority);
        command
    }

    fn require_game(&self) -> Outcome {
        let title = self
            .xdotool()
            .args(["getactivewindow", "getwindowname"])
            .stderr(Stdio::null())
            .output()
            .map(|output| substituted(&output.stdout))
            .unwrap_or_default();
        if title == GAME_WINDOW {
            Ok(())
        } else {
            Err(Stop::err(
                1,
                format!(
                    "Focus changed or unexpected private window ({}); stopping.",
                    shell_quoted(&title)
                ),
            ))
        }
    }

    fn release(&self, keys: &[String]) {
        for key in keys {
            let _ = self
                .xdotool()
                .args(["keyup", key])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
    }
}

struct Pressing {
    display: Arc<Display>,
    held: Arc<Mutex<Vec<String>>>,
}

impl Pressing {
    fn start(
        display: Arc<Display>,
        held: Vec<String>,
        child: Arc<Mutex<Option<u32>>>,
    ) -> Result<Self, Stop> {
        let held = Arc::new(Mutex::new(held));
        let (signal_display, signal_held) = (Arc::clone(&display), Arc::clone(&held));
        ctrlc::set_handler(move || {
            if let Some(pid) = *child
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
            {
                unsafe { libc::kill(pid as libc::pid_t, libc::SIGTERM) };
            }
            signal_display.release(
                &signal_held
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner()),
            );
            std::process::exit(130);
        })
        .map_err(|error| Stop::err(1, format!("signal handler: {error}")))?;
        Ok(Self { display, held })
    }

    fn finish(self) {
        self.held
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clear();
    }
}

impl Drop for Pressing {
    fn drop(&mut self) {
        self.display.release(
            &self
                .held
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner()),
        );
    }
}

fn send(display: Display, plan: Plan) -> Outcome {
    if find_program("xdotool").is_none() {
        return Err(Stop::err(
            1,
            "xdotool is required in this shell (for example: nix shell nixpkgs#xdotool).",
        ));
    }
    if display.display.is_empty() {
        return Err(Stop::err(1, "Private X display is empty."));
    }
    let display = Arc::new(display);
    display.require_game()?;
    let child = Arc::new(Mutex::new(None));
    let pressing = Pressing::start(Arc::clone(&display), plan.held, Arc::clone(&child))?;
    let mut chain = display.xdotool();
    chain.args(&plan.actions);
    let mut sending = chain
        .spawn()
        .map_err(|error| spawn_failure(&chain, error))?;
    *child
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(sending.id());
    let sent = sending
        .wait()
        .map_err(|error| spawn_failure(&chain, error))?;
    *child
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
    if !sent.success() {
        return Err(Stop::silent(exit_code(sent)));
    }
    display.require_game()?;
    pressing.finish();
    println!("Chain sent. Verify the resulting game state before selecting another procedure.");
    Ok(())
}

pub fn cli(arguments: &[String]) -> Outcome {
    let (run_directory, state, recipe) = match arguments {
        [flag, state, recipe] if flag == "--validate" => (None, state, recipe),
        [run_directory, state, recipe] => (Some(run_directory), state, recipe),
        _ => return Err(Stop::err(2, USAGE)),
    };
    if !(is_name(state, 40) && is_name(recipe, 64)) {
        return Err(Stop::err(2, USAGE));
    }
    if let Some(run_directory) = run_directory {
        if !is_run_directory(run_directory) {
            return Err(Stop::err(
                1,
                "Refusing a run directory outside this user private desktops.",
            ));
        }
        let run_directory = Path::new(run_directory);
        let live = run_directory.is_dir()
            && run_directory.join("display").is_file()
            && run_directory.join("xauthority").is_file()
            && has_wayland(run_directory);
        if !live {
            return Err(Stop::err(
                1,
                "Private desktop identity is incomplete or no longer live.",
            ));
        }
    }
    let chain = recipes().join(format!("{recipe}.chain"));
    let regular = fs::symlink_metadata(&chain).is_ok_and(|metadata| metadata.is_file());
    let text = fs::read_to_string(&chain).ok().filter(|_| regular);
    let text = text.ok_or_else(|| Stop::err(2, format!("Unknown procedure: {recipe}")))?;
    let plan = plan(&text)?;
    if plan.caller_state != *state {
        let required = if plan.caller_state.is_empty() {
            "<missing>"
        } else {
            &plan.caller_state
        };
        return Err(Stop::err(
            1,
            format!("Procedure {recipe} requires state {required}; caller supplied {state}."),
        ));
    }
    println!(
        "Procedure: {recipe} | required caller state: {state} | actions: {} | input span: {} ms",
        plan.count, plan.span_ms
    );
    let Some(run_directory) = run_directory else {
        println!("Recipe validation only; no display accessed and no input sent.");
        return Ok(());
    };
    send(Display::read(Path::new(run_directory))?, plan)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn refusal(chain: &str) -> u8 {
        plan(chain).err().map(|stop| stop.code()).unwrap_or(0)
    }

    #[test]
    fn a_chord_presses_both_keys_and_releases_them_in_reverse() {
        let chain = "# caller-state match-running\n#  note\nchord Control_L+F9 80\n\twait  120 \ntap Escape 50";
        let plan = plan(chain).unwrap();
        assert_eq!(plan.caller_state, "match-running");
        assert_eq!(
            plan.actions.join(" "),
            "keydown Control_L keydown F9 sleep 0.080 keyup F9 keyup Control_L sleep 0.120 keydown Escape sleep 0.050 keyup Escape"
        );
        assert_eq!(plan.held, ["Control_L", "F9", "Escape"]);
        assert_eq!((plan.count, plan.span_ms), (3, 250));
    }

    #[test]
    fn the_checked_in_recipes_plan_within_their_limits() {
        let mut planned = 0;
        for entry in fs::read_dir(recipes()).unwrap() {
            let plan = plan(&fs::read_to_string(entry.unwrap().path()).unwrap()).unwrap();
            assert!(
                !plan.caller_state.is_empty()
                    && plan.count <= ACTION_LIMIT
                    && plan.span_ms <= SPAN_LIMIT_MS
            );
            planned += 1;
        }
        assert!(planned > 0);
    }

    #[test]
    fn enter_keys_overlong_actions_and_unknown_lines_are_refused() {
        for chain in [
            "tap Return 50",
            "chord shift+KP_Enter 50",
            "hold a 1501",
            "wait 1501",
            "wait 50 50",
            "tap a 050",
            "chord a+b+c 50",
            "tap a 50 extra",
            "click 1 2",
            "",
            &"tap a 1\n".repeat(41),
            &"wait 1500\n".repeat(6),
        ] {
            assert_eq!(refusal(chain), 2, "{chain:?}");
        }
        assert_eq!(refusal(&"wait 1000\n".repeat(8)), 0);
    }

    #[test]
    fn names_follow_the_recipe_and_state_shapes() {
        assert!(is_name("match-running", 40) && is_name("0_a", 40));
        assert!(
            !is_name("", 40)
                && !is_name("-a", 40)
                && !is_name("Match", 40)
                && !is_name(&"a".repeat(41), 40)
        );
        assert_eq!(shell_quoted("Warcraft III (x)"), "Warcraft\\ III\\ \\(x\\)");
        assert_eq!(shell_quoted(""), "''");
    }
}
