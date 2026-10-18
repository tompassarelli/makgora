use std::env;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};

use crate::process::{find_program, is_executable, project_root};
use crate::step::{Run, Step, execute};
use crate::stop::{Outcome, Stop};

const DEFAULT_CASC_SOURCE: &str = "/home/tom/code/casclib/worktrees/assets";
const DEFAULT_STORAGE: &str = "/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/Program Files (x86)/Warcraft III";
const RIFLEMAN_MODELS: [&str; 1] = ["units/human/rifleman/rifleman"];
// This installed build stores DDS textures even when model paths end in BLP.
const RIFLEMAN_TEXTURES: [&str; 8] = [
    "Textures/Ranger",
    "Textures/star2_32",
    "Textures/gutz",
    "Units/Human/Rifleman/Rifleman",
    "Textures/Dust3x",
    "Textures/Flame4",
    "ReplaceableTextures/TeamColor/TeamColor00",
    "ReplaceableTextures/TeamColor/TeamColor01",
];
const DEMONHUNTER_TEXTURES: [&str; 7] = [
    "HeroDemonHunter",
    "Black32",
    "Shadow",
    "Dust5ABlack",
    "Zap1",
    "Clouds8x8Mod",
    "Clouds8x8FadeWhite",
];
const DEMONHUNTER_TEAM_TEXTURES: [&str; 2] = ["TeamColor/TeamColor00", "TeamGlow/TeamGlow00"];

pub struct Sources {
    project: PathBuf,
    casc: PathBuf,
    storage: PathBuf,
}

impl Sources {
    fn from_environment() -> Self {
        let setting = |name: &str, default: &str| {
            PathBuf::from(
                env::var_os(name)
                    .filter(|value| !value.is_empty())
                    .unwrap_or_else(|| default.into()),
            )
        };
        Self {
            project: project_root(),
            casc: setting("CASC_SOURCE", DEFAULT_CASC_SOURCE),
            storage: setting("WC3_STORAGE", DEFAULT_STORAGE),
        }
    }

    fn animations(&self) -> PathBuf {
        self.project.join("tools/animations")
    }

    fn compile(&self, compiler: impl Into<OsString>, output: &Path) -> Step {
        Step::Run(
            Run::new(compiler)
                .args([
                    "-O2".into(),
                    "-I".into(),
                    self.casc.join("src").into_os_string(),
                ])
                .arg(self.animations().join("casc-extract.cpp"))
                .arg(self.casc.join("build/libcasc.a"))
                .args(["-pthread", "-o"])
                .arg(output),
        )
    }

    fn extract(
        &self,
        extractor: &Path,
        archived: &str,
        target: impl Into<OsString>,
        directory: Option<&Path>,
    ) -> Step {
        Step::Run(
            Run::new(extractor)
                .arg(&self.storage)
                .arg(format!("war3.w3mod:{archived}"))
                .arg(target)
                .within(directory),
        )
    }

    fn texture(
        &self,
        extractor: &Path,
        archived: &str,
        target: &Path,
        directory: Option<&Path>,
    ) -> [Step; 3] {
        let suffixed = |suffix: &str| {
            let mut path = target.as_os_str().to_owned();
            path.push(suffix);
            path
        };
        [
            Step::Directory(target.parent().unwrap_or(target).to_path_buf()),
            self.extract(
                extractor,
                &format!("{archived}.dds"),
                suffixed(".dds"),
                directory,
            ),
            Step::Run(
                Run::new("magick")
                    .arg(suffixed(".dds[0]"))
                    .arg(suffixed(".png"))
                    .within(directory),
            ),
        ]
    }

    fn blender(&self, script: &str, arguments: &[&OsStr], log: PathBuf) -> Run {
        let run = Run::new("blender")
            .args([
                "--background",
                "--threads",
                "2",
                "--python-exit-code",
                "1",
                "--python",
            ])
            .arg(self.animations().join(script));
        let run = if arguments.is_empty() {
            run
        } else {
            run.arg("--").args(arguments)
        };
        run.logged(log)
    }

    pub fn animation_assets(&self) -> PathBuf {
        self.project.join("build/animation-assets")
    }

    pub fn extract_animation_assets(&self) -> Vec<Step> {
        let output = self.animation_assets();
        let extractor = output.join("casc-extract");
        let animations = self.animations();
        let within = Some(animations.as_path());
        let mut steps = vec![
            Step::Directory(output.clone()),
            self.compile("g++", &extractor),
            Step::Run(
                Run::new("bun")
                    .args(["install", "--frozen-lockfile"])
                    .within(within),
            ),
        ];
        for model in RIFLEMAN_MODELS {
            let name = model.rsplit('/').next().unwrap_or(model);
            let (mdx, mdl) = (
                output.join(format!("{name}.mdx")),
                output.join(format!("{name}.mdl")),
            );
            steps.push(self.extract(&extractor, &format!("{model}.mdx"), &mdx, within));
            let convert = Run::new("bun")
                .arg(animations.join("convert.ts"))
                .arg(&mdx)
                .arg(&mdl);
            steps.push(Step::Run(convert.within(within)));
        }
        for texture in RIFLEMAN_TEXTURES {
            steps.extend(self.texture(
                &extractor,
                texture,
                &output.join("textures").join(texture),
                within,
            ));
        }
        steps
    }

    pub fn author_animation_assets(&self) -> Vec<Step> {
        let assets = self.animation_assets();
        vec![
            Step::Run(self.blender(
                "import.py",
                &["rifleman".as_ref()],
                assets.join("import-rifleman.log"),
            )),
            Step::Run(self.blender("rifleman.py", &[], assets.join("author-rifleman.log"))),
            Step::Run(self.blender(
                "strikes.py",
                &["rifleman".as_ref()],
                assets.join("author-rifleman-strikes.log"),
            )),
            Step::Run(Run::new("bun").arg(self.animations().join("package.ts"))),
        ]
    }

    pub fn demonhunter_assets(&self) -> PathBuf {
        self.project.join("build/illidan-assets")
    }

    pub fn extract_demonhunter(&self, extractor: &Path, compiler: Option<OsString>) -> Vec<Step> {
        let output = self.demonhunter_assets();
        let mut steps = vec![Step::Directory(output.clone())];
        steps.extend(compiler.map(|compiler| self.compile(compiler, extractor)));
        let model = "units/nightelf/herodemonhunter/herodemonhunter.mdx";
        steps.push(self.extract(extractor, model, output.join("demonhunter.mdx"), None));
        for texture in DEMONHUNTER_TEXTURES {
            let target = output.join("textures/Textures").join(texture);
            steps.extend(self.texture(extractor, &format!("Textures/{texture}"), &target, None));
        }
        for texture in DEMONHUNTER_TEAM_TEXTURES {
            let target = output.join("textures/ReplaceableTextures").join(texture);
            steps.extend(self.texture(
                extractor,
                &format!("ReplaceableTextures/{texture}"),
                &target,
                None,
            ));
        }
        steps
    }

    pub fn build_lichking(
        &self,
        inputs: &Path,
        existing: Option<&str>,
        extra: &[String],
    ) -> Vec<Step> {
        let build = inputs.join("build");
        let (source, authored) = (
            inputs.join("src/LichKing2.mdx"),
            build.join("LichKing2.mdl"),
        );
        let author = self
            .blender(
                "lichking.py",
                &[authored.as_os_str(), build.as_os_str()],
                build.join("author.log"),
            )
            .without("LD_LIBRARY_PATH");
        let package = Run::new("bun")
            .arg(self.animations().join("package-lichking.ts"))
            .arg(&source)
            .arg(&build)
            .arg(inputs.join("LichKingFighter.mdx"))
            .args(
                existing
                    .into_iter()
                    .flat_map(|model| ["--append-to", model]),
            )
            .args(extra);
        vec![
            Step::Directory(build.clone()),
            Step::Run(
                Run::new("bun")
                    .arg(self.animations().join("convert.ts"))
                    .arg(&source)
                    .arg(&authored),
            ),
            Step::Run(author),
            Step::Run(package),
        ]
    }
}

fn no_arguments(tool: &str, arguments: &[String]) -> Outcome {
    if arguments.is_empty() {
        Ok(())
    } else {
        Err(Stop::err(2, format!("Usage: smashcraft-tools {tool}")))
    }
}

pub fn extract_animation_assets_cli(arguments: &[String]) -> Outcome {
    no_arguments("extract-animation-assets", arguments)?;
    let sources = Sources::from_environment();
    execute(&sources.extract_animation_assets())?;
    println!(
        "Models and textures: {}",
        sources.animation_assets().display()
    );
    Ok(())
}

pub fn build_animation_assets_cli(arguments: &[String]) -> Outcome {
    no_arguments("build-animation-assets", arguments)?;
    let sources = Sources::from_environment();
    execute(&sources.extract_animation_assets())?;
    println!(
        "Models and textures: {}",
        sources.animation_assets().display()
    );
    execute(&sources.author_animation_assets())
}

pub fn extract_demonhunter_cli(arguments: &[String]) -> Outcome {
    no_arguments("extract-demonhunter", arguments)?;
    let sources = Sources::from_environment();
    let output = sources.demonhunter_assets();
    let extractor = env::var_os("CASC_EXTRACTOR").filter(|value| !value.is_empty());
    let extractor = extractor.map_or_else(|| output.join("casc-extract"), PathBuf::from);
    let compiler = if is_executable(&extractor) {
        None
    } else {
        let compiler = env::var("CXX")
            .ok()
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "g++".to_owned());
        if find_program(&compiler).is_none() {
            return Err(Stop::err(
                1,
                format!("C++ compiler {compiler} is required to build the CASC extractor"),
            ));
        }
        Some(compiler.into())
    };
    execute(&sources.extract_demonhunter(&extractor, compiler))?;
    println!(
        "Demon Hunter model and source textures: {}",
        output.display()
    );
    Ok(())
}

pub fn build_lichking_cli(arguments: &[String]) -> Outcome {
    let given = |index: usize| arguments.get(index).filter(|value| !value.is_empty());
    let inputs = given(0).map_or_else(
        || {
            PathBuf::from(env::var_os("HOME").unwrap_or_default())
                .join(".local/share/smashcraft-build-inputs/lich-king-20261007")
        },
        PathBuf::from,
    );
    let sources = Sources::from_environment();
    execute(&sources.build_lichking(
        &inputs,
        given(1).map(String::as_str),
        arguments.get(2..).unwrap_or_default(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sources() -> Sources {
        Sources {
            project: "/p".into(),
            casc: "/casc".into(),
            storage: "/wc3".into(),
        }
    }

    fn rendered(steps: &[Step]) -> Vec<String> {
        steps.iter().map(ToString::to_string).collect()
    }

    #[test]
    fn every_texture_is_extracted_as_dds_then_its_first_level_converted_to_png() {
        let steps = rendered(&sources().extract_demonhunter(Path::new("/x/casc-extract"), None));
        assert_eq!(
            steps[1],
            "/x/casc-extract /wc3 war3.w3mod:units/nightelf/herodemonhunter/herodemonhunter.mdx /p/build/illidan-assets/demonhunter.mdx"
        );
        assert_eq!(
            steps[steps.len() - 3..],
            [
                "mkdir /p/build/illidan-assets/textures/ReplaceableTextures/TeamGlow",
                "/x/casc-extract /wc3 war3.w3mod:ReplaceableTextures/TeamGlow/TeamGlow00.dds /p/build/illidan-assets/textures/ReplaceableTextures/TeamGlow/TeamGlow00.dds",
                "magick /p/build/illidan-assets/textures/ReplaceableTextures/TeamGlow/TeamGlow00.dds[0] /p/build/illidan-assets/textures/ReplaceableTextures/TeamGlow/TeamGlow00.png",
            ]
        );
        assert_eq!(steps.len(), 2 + 3 * 9);
    }

    #[test]
    fn the_demon_hunter_extractor_is_compiled_only_when_missing() {
        let compiled = rendered(
            &sources().extract_demonhunter(Path::new("/x/casc-extract"), Some("clang++".into())),
        );
        assert_eq!(
            compiled[1],
            "clang++ -O2 -I /casc/src /p/tools/animations/casc-extract.cpp /casc/build/libcasc.a -pthread -o /x/casc-extract"
        );
        let reused = rendered(&sources().extract_demonhunter(Path::new("/x/casc-extract"), None));
        assert!(reused.iter().all(|step| !step.contains("casc-extract.cpp")));
    }

    #[test]
    fn the_lich_king_packager_appends_only_to_a_named_model_and_forwards_the_rest() {
        let extra = ["--replace".to_owned(), "Stand".to_owned()];
        let steps = rendered(&sources().build_lichking(Path::new("/in"), Some("/old.mdx"), &extra));
        assert_eq!(
            steps[2],
            "-LD_LIBRARY_PATH blender --background --threads 2 --python-exit-code 1 --python /p/tools/animations/lichking.py -- /in/build/LichKing2.mdl /in/build > /in/build/author.log"
        );
        assert_eq!(
            steps[3],
            "bun /p/tools/animations/package-lichking.ts /in/src/LichKing2.mdx /in/build /in/LichKingFighter.mdx --append-to /old.mdx --replace Stand"
        );
        let fresh = rendered(&sources().build_lichking(Path::new("/in"), None, &extra));
        assert_eq!(
            fresh[3],
            "bun /p/tools/animations/package-lichking.ts /in/src/LichKing2.mdx /in/build /in/LichKingFighter.mdx --replace Stand"
        );
    }

    #[test]
    fn rifleman_assets_extract_in_the_animation_tools_then_author_in_blender() {
        let mut steps = rendered(&sources().extract_animation_assets());
        steps.extend(rendered(&sources().author_animation_assets()));
        assert_eq!(
            steps[2],
            "[/p/tools/animations] bun install --frozen-lockfile"
        );
        assert_eq!(
            steps[4],
            "[/p/tools/animations] bun /p/tools/animations/convert.ts /p/build/animation-assets/rifleman.mdx /p/build/animation-assets/rifleman.mdl"
        );
        assert_eq!(steps.len(), 5 + 3 * 8 + 4);
        assert_eq!(
            steps[steps.len() - 2],
            "blender --background --threads 2 --python-exit-code 1 --python /p/tools/animations/strikes.py -- rifleman > /p/build/animation-assets/author-rifleman-strikes.log"
        );
    }
}
