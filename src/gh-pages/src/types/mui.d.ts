import { PaletteColorOptions } from "@mui/material/styles";

declare module "@mui/material/styles" {
    interface Palette {
        github: Palette["primary"];
        linkedin: Palette["primary"];
        pdf: Palette["primary"];
    }
    interface PaletteOptions {
        github?: PaletteColorOptions;
        linkedin?: PaletteColorOptions;
        pdf?: PaletteColorOptions;
    }
}

declare module "@mui/material/Button" {
    interface ButtonPropsColorOverrides {
        github: true;
        linkedin: true;
        pdf: true;
    }
}
