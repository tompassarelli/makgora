mod assets;
mod auth_transport;
mod private_desktop;
mod procedure;
mod process;
mod screen_state;
mod step;
mod stop;
mod wait_state;

use std::process::ExitCode;

use stop::{Outcome, Stop};

type Tool = fn(&[String]) -> Outcome;

const TOOLS: &[(&str, Tool)] = &[
    ("wc3-screen-state", screen_state::cli),
    ("bench-wc3-screen-state", screen_state::bench_cli),
    ("wc3-wait-state", wait_state::cli),
    ("wc3-procedure", procedure::cli),
    ("wc3-auth-transport", auth_transport::cli),
    (
        "extract-animation-assets",
        assets::extract_animation_assets_cli,
    ),
    ("build-animation-assets", assets::build_animation_assets_cli),
    ("extract-demonhunter", assets::extract_demonhunter_cli),
    ("build-lichking", assets::build_lichking_cli),
];

fn usage() -> Stop {
    let names: Vec<&str> = TOOLS.iter().map(|(name, _)| *name).collect();
    Stop::err(
        2,
        format!(
            "Usage: smashcraft-tools TOOL [ARGUMENT]...\nTools: {}",
            names.join(", ")
        ),
    )
}

fn main() -> ExitCode {
    let mut arguments = std::env::args().skip(1);
    let tool = arguments.next().unwrap_or_default();
    let arguments: Vec<String> = arguments.collect();
    let outcome = TOOLS
        .iter()
        .find(|(name, _)| *name == tool)
        .map_or_else(|| Err(usage()), |(_, cli)| cli(&arguments));
    outcome.map_or_else(Stop::report, |()| ExitCode::SUCCESS)
}
