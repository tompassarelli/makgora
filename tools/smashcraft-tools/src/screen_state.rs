use std::ffi::OsString;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Instant;

use crate::process::{exit_code, output, spawn_failure};
use crate::stop::{Outcome, Stop};

const USAGE: &str = "Usage: smashcraft-tools wc3-screen-state IMAGE [compact|full]";
const BENCH_USAGE: &str = "Usage: smashcraft-tools bench-wc3-screen-state FIXTURE_DIR";
const GEOMETRY: &str = "2560x1440";
const BRIGHT_TEXT: &str = "(r>0.667 && g>0.588)?0:1";
const LABEL_REGIONS: [&str; 3] = ["450x260+1850+490", "500x90+90+140", "700x80+950+370"];
const FIXTURES: [(&str, ScreenState); 4] = [
    ("a-before", ScreenState::MainMenu),
    ("a-after-key", ScreenState::SinglePlayer),
    ("a-after-custom-click", ScreenState::CreateGame),
    ("a-relative-click", ScreenState::Disconnected),
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ScreenState {
    MainMenu,
    SinglePlayer,
    CreateGame,
    Disconnected,
}

impl ScreenState {
    pub fn name(self) -> &'static str {
        match self {
            Self::MainMenu => "main-menu",
            Self::SinglePlayer => "single-player",
            Self::CreateGame => "create-game",
            Self::Disconnected => "disconnected",
        }
    }

    pub fn menu(name: &str) -> Option<Self> {
        [Self::MainMenu, Self::SinglePlayer, Self::CreateGame]
            .into_iter()
            .find(|state| state.name() == name)
    }
}

#[derive(Clone, Copy, Debug)]
pub enum Mode {
    Compact,
    Full,
}

impl Mode {
    fn parse(name: &str) -> Option<Self> {
        match name {
            "compact" => Some(Self::Compact),
            "full" => Some(Self::Full),
            _ => None,
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::Compact => "compact",
            Self::Full => "full",
        }
    }
}

pub fn classify(text: &str) -> Option<ScreenState> {
    let text = text.to_uppercase();
    let main_menu = text
        .find("SINGLE PLAYER")
        .is_some_and(|at| text[at + "SINGLE PLAYER".len()..].contains("MULTIPLAYER"));
    if text.contains("DISCONNECT") {
        Some(ScreenState::Disconnected)
    } else if text.contains("CREATE GAME") {
        Some(ScreenState::CreateGame)
    } else if text.contains("CUSTOM GAMES") {
        Some(ScreenState::SinglePlayer)
    } else if main_menu {
        Some(ScreenState::MainMenu)
    } else {
        None
    }
}

fn mask_arguments(image: &Path, mode: Mode) -> Vec<OsString> {
    let mut arguments: Vec<OsString> = vec![image.into()];
    let mut push = |items: &[&str]| arguments.extend(items.iter().map(OsString::from));
    if let Mode::Compact = mode {
        let [first, rest @ ..] = LABEL_REGIONS;
        push(&["(", "+clone", "-crop", first, "+repage", ")"]);
        for region in rest {
            push(&["(", "-clone", "0", "-crop", region, "+repage", ")"]);
        }
        push(&[
            "-delete",
            "0",
            "-background",
            "black",
            "-gravity",
            "west",
            "-append",
        ]);
    }
    push(&["-fx", BRIGHT_TEXT, "png:-"]);
    arguments
}

fn read_text(image: &Path, mode: Mode) -> Result<String, Stop> {
    let mut mask = Command::new("magick");
    mask.args(mask_arguments(image, mode))
        .env("OMP_THREAD_LIMIT", "1")
        .stdout(Stdio::piped());
    let mut masking = mask.spawn().map_err(|error| spawn_failure(&mask, error))?;
    let mut reader = Command::new("tesseract");
    reader
        .args(["stdin", "stdout", "--psm", "11"])
        .env("OMP_THREAD_LIMIT", "1")
        .stdin(masking.stdout.take().map_or_else(Stdio::null, Stdio::from))
        .stderr(Stdio::null());
    let reading = reader
        .output()
        .map_err(|error| spawn_failure(&reader, error));
    let masked = masking
        .wait()
        .map_err(|error| spawn_failure(&mask, error))?;
    let reading = reading?;
    if !reading.status.success() {
        return Err(Stop::silent(exit_code(reading.status)));
    }
    if !masked.success() {
        return Err(Stop::silent(exit_code(masked)));
    }
    Ok(String::from_utf8_lossy(&reading.stdout).into_owned())
}

pub fn observe(image: &Path, mode: Mode) -> Result<ScreenState, Stop> {
    if !image.is_file() {
        return Err(Stop::silent(2));
    }
    let geometry = output(
        Command::new("magick")
            .args(["identify", "-format", "%wx%h"])
            .arg(image),
    )?;
    if geometry != GEOMETRY {
        return Err(Stop::out(1, format!("unsupported-geometry: {geometry}")));
    }
    classify(&read_text(image, mode)?).ok_or_else(|| Stop::out(1, "unknown"))
}

pub fn cli(arguments: &[String]) -> Outcome {
    let (image, mode) = match arguments {
        [image] => (image, Some(Mode::Compact)),
        [image, mode] => (image, Mode::parse(mode)),
        _ => return Err(Stop::err(2, USAGE)),
    };
    let mode = mode.ok_or_else(|| Stop::silent(2))?;
    println!("{}", observe(Path::new(image), mode)?.name());
    Ok(())
}

pub fn bench_cli(arguments: &[String]) -> Outcome {
    let [directory] = arguments else {
        return Err(Stop::err(2, BENCH_USAGE));
    };
    let directory = Path::new(directory);
    if !directory.is_dir() {
        return Err(Stop::err(2, BENCH_USAGE));
    }
    println!("sample\tfixture\tmode\telapsed_ms\tstate");
    for sample in 1..=3 {
        let modes = if sample % 2 == 1 {
            [Mode::Full, Mode::Compact]
        } else {
            [Mode::Compact, Mode::Full]
        };
        for (fixture, expected) in FIXTURES {
            for mode in modes {
                let start = Instant::now();
                let state = observe(&directory.join(format!("{fixture}.png")), mode)
                    .map_err(Stop::captured)?;
                let elapsed = start.elapsed().as_millis();
                if state != expected {
                    return Err(Stop::err(
                        1,
                        format!("Unexpected state for {fixture}: {}", state.name()),
                    ));
                }
                println!(
                    "{sample}\t{fixture}\t{}\t{elapsed}\t{}",
                    mode.name(),
                    state.name()
                );
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_disconnect_label_wins_over_the_menu_under_it() {
        assert_eq!(
            classify("Single Player\nMultiplayer\nYou have been disconnected"),
            Some(ScreenState::Disconnected)
        );
        assert_eq!(
            classify("CREATE GAME\nCUSTOM GAMES"),
            Some(ScreenState::CreateGame)
        );
        assert_eq!(
            classify("custom games\nsingle player multiplayer"),
            Some(ScreenState::SinglePlayer)
        );
    }

    #[test]
    fn the_main_menu_needs_single_player_before_multiplayer() {
        assert_eq!(
            classify("SINGLE PLAYER\n\nMULTIPLAYER\nOPTIONS"),
            Some(ScreenState::MainMenu)
        );
        assert_eq!(classify("MULTIPLAYER\nSINGLE PLAYER"), None);
        assert_eq!(classify("SINGLE PLAYER"), None);
        assert_eq!(classify(""), None);
    }

    #[test]
    fn compact_mode_masks_only_the_three_label_regions() {
        let arguments = mask_arguments(Path::new("frame.png"), Mode::Compact);
        let crops: Vec<_> = arguments
            .windows(2)
            .filter(|pair| pair[0] == "-crop")
            .map(|pair| pair[1].clone())
            .collect();
        assert_eq!(crops, LABEL_REGIONS.map(OsString::from));
        assert_eq!(
            arguments.last().map(OsString::as_os_str),
            Some("png:-".as_ref())
        );
        assert_eq!(
            mask_arguments(Path::new("frame.png"), Mode::Full),
            ["frame.png", "-fx", BRIGHT_TEXT, "png:-"].map(OsString::from)
        );
    }
}
