use std::fs;
use std::process::Command;

use crate::process::{output, substituted};
use crate::stop::{Outcome, Stop};

const USAGE: &str = "Usage: smashcraft-tools wc3-auth-transport LAUNCHER_PID";
const LAUNCHER: &str = "CrBrowserMain";
const PRESENT: &str =
    "transport-source-present: authentication still requires explicit launcher evidence";
const ABSENT: &str = "authentication-transport-absent: do not launch";
const STALE: &str =
    "stale-authentication-transport: source address removed; do not launch or request password";

fn addresses(listing: &str) -> Vec<&str> {
    listing
        .split('\n')
        .map(|line| {
            line.split_whitespace()
                .nth(3)
                .and_then(|address| address.split('/').next())
                .unwrap_or("")
        })
        .collect()
}

pub fn verdict(
    address_listing: &str,
    socket_listing: &str,
    pid: &str,
) -> Result<&'static str, &'static str> {
    let owner = format!("pid={pid},");
    let sockets: Vec<&str> = socket_listing
        .split('\n')
        .filter(|line| line.contains(&owner))
        .collect();
    if sockets.is_empty() {
        return Err(ABSENT);
    }
    let addresses = addresses(address_listing);
    let stale = sockets.iter().any(|socket| {
        let local = socket.split_whitespace().nth(3).unwrap_or("");
        let source = local.rfind(':').map_or(local, |colon| &local[..colon]);
        !addresses.contains(&source)
    });
    if stale {
        return Err(STALE);
    }
    Ok(PRESENT)
}

pub fn cli(arguments: &[String]) -> Outcome {
    let shaped = |pid: &String| {
        !pid.starts_with('0') && !pid.is_empty() && pid.bytes().all(|byte| byte.is_ascii_digit())
    };
    let [pid] = arguments else {
        return Err(Stop::err(2, USAGE));
    };
    if !shaped(pid) {
        return Err(Stop::err(2, USAGE));
    }
    let comm =
        fs::read(format!("/proc/{pid}/comm")).map_err(|_| Stop::out(1, "launcher-missing"))?;
    if substituted(&comm) != LAUNCHER {
        return Err(Stop::out(1, "unexpected-process"));
    }
    let address_listing = output(Command::new("ip").args(["-o", "-4", "address", "show"]))?;
    let socket_listing = output(Command::new("ss").args(["-Htnp", "dport = :1119"]))?;
    println!(
        "{}",
        verdict(&address_listing, &socket_listing, pid).map_err(|refusal| Stop::out(1, refusal))?
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const ADDRESSES: &str = "\
1: lo    inet 127.0.0.1/8 scope host lo\\       valid_lft forever preferred_lft forever
3: wlp0s20f3    inet 192.168.1.23/24 brd 192.168.1.255 scope global dynamic noprefixroute wlp0s20f3\\       valid_lft 85621sec";

    fn socket(source: &str, pid: u32) -> String {
        format!(
            "ESTAB 0      0      {source}:51234 137.221.106.19:1119 users:((\"Battle.net.exe\",pid={pid},fd=88))"
        )
    }

    #[test]
    fn a_socket_from_a_live_address_is_present() {
        let sockets = [socket("192.168.1.23", 4242), socket("10.0.0.9", 42)].join("\n");
        assert_eq!(verdict(ADDRESSES, &sockets, "4242"), Ok(PRESENT));
    }

    #[test]
    fn a_socket_from_a_removed_address_is_stale() {
        let sockets = [socket("192.168.1.23", 4242), socket("10.0.0.9", 4242)].join("\n");
        assert_eq!(verdict(ADDRESSES, &sockets, "4242"), Err(STALE));
    }

    #[test]
    fn only_the_launchers_own_sockets_count() {
        assert_eq!(
            verdict(ADDRESSES, &socket("192.168.1.23", 42420), "4242"),
            Err(ABSENT)
        );
        assert_eq!(verdict(ADDRESSES, "", "4242"), Err(ABSENT));
    }
}
