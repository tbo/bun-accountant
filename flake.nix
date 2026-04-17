{
  description = "dev tools";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { nixpkgs, ... }:
    let
      system = builtins.currentSystem;
      pkgs = import nixpkgs { inherit system; };
    in
    {
      packages.${system}.default = pkgs.buildEnv {
        name = "dev-tools";
        paths = with pkgs; [
          bashInteractive
          cacert
          coreutils
          curl
          delve
          esbuild
          findutils
          gawk
          gcc
          git
          gnugrep
          gnused
          go-task
          go_1_26
          golangci-lint
          golangci-lint-langserver
          gnumake
          gopls
          nodejs_22
          nodePackages.typescript
          nodePackages.typescript-language-server
          postgresql
          squawk
          vscode-langservers-extracted
        ];
      };
    };
}
