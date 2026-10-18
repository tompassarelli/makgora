use std::env;
use std::fs;
use std::io::ErrorKind;
use std::os::unix::fs::PermissionsExt;
use std::os::unix::process::ExitStatusExt;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};

use crate::stop::{Outcome, Stop};

pub fn exit_code(status: ExitStatus) -> u8 {
    match (status.code(), status.signal()) {
        (Some(code), _) => code as u8,
        (None, Some(signal)) => 128u8.wrapping_add(signal as u8),
        (None, None) => 1,
    }
}

pub fn spawn_failure(command: &Command, error: std::io::Error) -> Stop {
    let program = command.get_program().to_string_lossy().into_owned();
    match error.kind() {
        ErrorKind::NotFound => Stop::err(127, format!("{program}: command not found")),
        _ => Stop::err(126, format!("{program}: {error}")),
    }
}

pub fn run(command: &mut Command) -> Outcome {
    let status = command
        .status()
        .map_err(|error| spawn_failure(command, error))?;
    if status.success() {
        Ok(())
    } else {
        Err(Stop::silent(exit_code(status)))
    }
}

pub fn output(command: &mut Command) -> Result<String, Stop> {
    let output = command
        .stdin(Stdio::inherit())
        .stderr(Stdio::inherit())
        .output()
        .map_err(|error| spawn_failure(command, error))?;
    if !output.status.success() {
        return Err(Stop::silent(exit_code(output.status)));
    }
    Ok(substituted(&output.stdout))
}

pub fn substituted(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes)
        .trim_end_matches('\n')
        .to_owned()
}

pub fn is_executable(path: &Path) -> bool {
    fs::metadata(path).is_ok_and(|metadata| metadata.permissions().mode() & 0o111 != 0)
}

pub fn find_program(name: &str) -> Option<PathBuf> {
    if name.contains('/') {
        return Some(PathBuf::from(name)).filter(|path| path.is_file() && is_executable(path));
    }
    let path = env::var_os("PATH")?;
    env::split_paths(&path)
        .map(|directory| directory.join(name))
        .find(|candidate| candidate.is_file() && is_executable(candidate))
}

pub fn project_root() -> PathBuf {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    fs::canonicalize(&root).unwrap_or(root)
}
