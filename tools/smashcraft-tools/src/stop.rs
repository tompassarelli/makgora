use std::process::ExitCode;

#[derive(Debug)]
enum Stream {
    Out,
    Err,
}

#[derive(Debug)]
pub struct Stop {
    code: u8,
    message: Option<(Stream, String)>,
}

pub type Outcome = Result<(), Stop>;

impl Stop {
    pub fn out(code: u8, text: impl Into<String>) -> Self {
        Self {
            code,
            message: Some((Stream::Out, text.into())),
        }
    }

    pub fn err(code: u8, text: impl Into<String>) -> Self {
        Self {
            code,
            message: Some((Stream::Err, text.into())),
        }
    }

    pub fn silent(code: u8) -> Self {
        Self {
            code,
            message: None,
        }
    }

    #[cfg(test)]
    pub fn code(&self) -> u8 {
        self.code
    }

    pub fn captured(self) -> Self {
        match self.message {
            Some((Stream::Out, _)) => Self::silent(self.code),
            message => Self {
                code: self.code,
                message,
            },
        }
    }

    pub fn report(self) -> ExitCode {
        match self.message {
            Some((Stream::Out, text)) => println!("{text}"),
            Some((Stream::Err, text)) => eprintln!("{text}"),
            None => {}
        }
        ExitCode::from(self.code)
    }
}
