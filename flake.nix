{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      addonPin = pkgs.lib.trim (builtins.readFile ./tools/animations/mdl-exporter4.pin);
    in
    {
      packages.${system}.selection-fonts = pkgs.dejavu_fonts;
      formatter.${system} = pkgs.nixfmt-tree.override { settings.global.excludes = [ "repos/**" ]; };
      devShells.${system}.default = pkgs.mkShell {
        packages = [ pkgs.blender ];
        shellHook = ''
          export WC3_MDL_ADDON="$HOME/.local/share/makgora-build-inputs/store/mdl-exporter4/${addonPin}"
          if [ ! -d "$WC3_MDL_ADDON" ]; then
            echo "Missing pinned mdl-exporter4 input: $WC3_MDL_ADDON; build-animation-assets will refuse to run" >&2
          fi
        '';
      };
    };
}
