use std::ffi::OsString;
use std::fmt;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::process::run;
use crate::stop::{Outcome, Stop};

#[derive(Debug)]
pub enum Step {
    Directory(PathBuf),
    Run(Run),
}

#[derive(Debug)]
pub struct Run {
    program: OsString,
    arguments: Vec<OsString>,
    directory: Option<PathBuf>,
    log: Option<PathBuf>,
}

impl Run {
    pub fn new(program: impl Into<OsString>) -> Self {
        Self {
            program: program.into(),
            arguments: Vec::new(),
            directory: None,
            log: None,
        }
    }

    pub fn arg(mut self, argument: impl Into<OsString>) -> Self {
        self.arguments.push(argument.into());
        self
    }

    pub fn args<T: Into<OsString>>(mut self, arguments: impl IntoIterator<Item = T>) -> Self {
        self.arguments.extend(arguments.into_iter().map(Into::into));
        self
    }

    pub fn within(mut self, directory: Option<&Path>) -> Self {
        self.directory = directory.map(Path::to_path_buf);
        self
    }

    pub fn logged(mut self, log: PathBuf) -> Self {
        self.log = Some(log);
        self
    }

    fn execute(&self) -> Outcome {
        let mut command = Command::new(&self.program);
        command.args(&self.arguments);
        if let Some(directory) = &self.directory {
            command.current_dir(directory);
        }
        if let Some(log) = &self.log {
            let file = File::create(log)
                .map_err(|error| Stop::err(1, format!("{}: {error}", log.display())))?;
            let copy = file
                .try_clone()
                .map_err(|error| Stop::err(1, format!("{}: {error}", log.display())))?;
            command.stdout(Stdio::from(file)).stderr(Stdio::from(copy));
        }
        run(&mut command)
    }
}

impl fmt::Display for Step {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        let run = match self {
            Step::Directory(path) => return write!(formatter, "mkdir {}", path.display()),
            Step::Run(run) => run,
        };
        if let Some(directory) = &run.directory {
            write!(formatter, "[{}] ", directory.display())?;
        }
        write!(formatter, "{}", run.program.to_string_lossy())?;
        for argument in &run.arguments {
            write!(formatter, " {}", argument.to_string_lossy())?;
        }
        if let Some(log) = &run.log {
            write!(formatter, " > {}", log.display())?;
        }
        Ok(())
    }
}

pub fn execute(steps: &[Step]) -> Outcome {
    for step in steps {
        match step {
            Step::Directory(path) => fs::create_dir_all(path)
                .map_err(|error| Stop::err(1, format!("mkdir {}: {error}", path.display())))?,
            Step::Run(run) => run.execute()?,
        }
    }
    Ok(())
}
