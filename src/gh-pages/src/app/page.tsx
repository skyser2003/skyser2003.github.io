"use client";

import * as React from "react";
import styles from "./page.module.css";
import Avatar from "@mui/material/Avatar";
import {
    Button,
    CircularProgress,
    createTheme,
    CssBaseline,
    Grid,
    Input,
    Link,
    Paper,
    ThemeProvider,
    Typography,
} from "@mui/material";
import { green } from "@mui/material/colors";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import modelsModule, { Downloader, Generator } from "@/models/pkg";

import langManager from "@/models/language/lang_manager";

let defaultTheme = createTheme({});

defaultTheme = createTheme({
    palette: {
        primary: green,
    },
});

const theme = createTheme({
    colorSchemes: {
        light: {
            palette: {
                primary: { main: defaultTheme.palette.primary.light },
                background: {
                    default: "#fafbfc",
                    paper: "#fff",
                },
            },
        },
        dark: {
            palette: {
                primary: { main: defaultTheme.palette.primary.dark },
                background: {
                    default: "#181a1b",
                    paper: "#23272b",
                },
            },
        },
    },
    cssVariables: {
        colorSchemeSelector: "class",
    },
    components: {
        MuiCardContent: {
            styleOverrides: {
                root: {
                    fontFamily: "DNFBitBitv2",
                },
            },
        },
        MuiTypography: {
            styleOverrides: {
                root: {
                    fontFamily: "DNFBitBitv2",
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    fontFamily: "DNFBitBitv2",
                },
            },
        },
    },
});

export default function Home() {
    const [language, setLanguage] = React.useState("");
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [isDownloading, setIsDownloading] = React.useState(false);
    const [isDownloaded, setIsDownloaded] = React.useState(false);

    if (language === "") {
        setLanguage(langManager.getLanguage());
    }

    React.useEffect(() => {
        const loadModule = async () => {
            await modelsModule();
            await Promise.all([checkDownloaded()]);
            setIsLoaded(true);
        };

        loadModule();
    }, []);

    if (!isLoaded) {
        return (
            <ThemeProvider theme={theme} defaultMode="system">
                <InitColorSchemeScript defaultMode="system" attribute="class" />
                <CssBaseline />
                <div className={styles.page}>
                    <main className={styles.main}>
                        <div>Loading...</div>
                    </main>
                </div>
            </ThemeProvider>
        );
    }

    const downloader = new Downloader("timinar/baby-llama-58m");

    async function clearCache() {
        const [modelRemoved, tokenizerRemoved] = await Promise.all([
            Downloader.remove("model"),
            Downloader.remove("tokenizer"),
        ]);

        setIsDownloaded(!(modelRemoved && tokenizerRemoved));
    }

    async function downloadRepository() {
        const localIsDownloaded = await checkDownloaded();

        if (isDownloading) {
            console.log("Currently downloading...");
            return;
        }

        if (isDownloaded || localIsDownloaded) {
            console.log("Already downloaded, skipping");
            return;
        }

        const modelDownload = downloader.save_file(
            "model.safetensors",
            "model"
        );

        const tokenDownload = downloader.save_file(
            "tokenizer.json",
            "tokenizer"
        );

        const configDownload = downloader.save_file("config.json", "config");

        setIsDownloading(true);

        const [model, tokenizer, config] = await Promise.all([
            modelDownload.start(),
            tokenDownload.start(),
            configDownload.start(),
        ]);

        modelDownload.on(
            "progress",
            (filename, bytesReceived, totalBytes, percentage) => {
                console.log(
                    `Downloading ${filename}: ${bytesReceived} / ${totalBytes} (${percentage}%)`
                );
            }
        );

        modelDownload.on("complete", (filename) => {
            console.log(`Download complete: ${filename}`);
        });

        await checkDownloaded();
        setIsDownloading(false);

        return [model, tokenizer, config];
    }

    async function onPressEnter(
        event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
    ) {
        if (event.key !== "Enter") {
            return;
        }

        await generateText();
    }

    async function generateText() {
        const promptInputElement = document.getElementById(
            "prompt_input"
        ) as HTMLInputElement;
        const generatedTextElement = document.getElementById("generated_text")!;

        const prompt = promptInputElement.value;

        promptInputElement.value = "";
        generatedTextElement.textContent = prompt;

        const data = await downloadRepository();

        let model = data ? data[0] : undefined;
        let tokenizer = data ? data[1] : undefined;
        let config = data ? data[2] : undefined;

        if (model === undefined) {
            model = await Downloader.get("model");
        }

        if (tokenizer === undefined) {
            tokenizer = await Downloader.get("tokenizer");
        }

        if (config === undefined) {
            config = await Downloader.get("config");
        }

        if (!model || !tokenizer || !config) {
            console.log("Model, tokenizer, or config not found");
            return;
        }

        const generator = new Generator(model, tokenizer, config);

        console.log("Model loading done, begin generating...");

        const startTime = performance.now();

        generator.generate(prompt, (token) => {
            generatedTextElement.textContent += token;
        });

        const endTime = performance.now();

        console.log(`Generation took ${endTime - startTime} ms`);
    }

    async function checkDownloaded() {
        const exists = await Promise.all([
            Downloader.model_exists(),
            Downloader.tokenizer_exists(),
            Downloader.config_exists(),
        ]);

        const downloaded = exists.every((e) => e);

        setIsDownloaded(downloaded);

        return downloaded;
    }

    return (
        <ThemeProvider theme={theme} defaultMode="system">
            <InitColorSchemeScript defaultMode="system" attribute="class" />
            <CssBaseline />
            <div className={styles.page}>
                <main className={styles.main}>
                    <Grid container spacing={2}>
                        <Grid
                            container
                            size={8}
                            className={styles.roundedBorderCard}
                            sx={{ backgroundColor: "background.paper" }}
                        >
                            <Grid size={8} className={styles.flexAlignCenter}>
                                <Paper
                                    elevation={3}
                                    className={styles.profileCard}
                                >
                                    <Avatar
                                        alt="skyser2003 github avatar"
                                        src="https://avatars.githubusercontent.com/u/1083291?v=4"
                                        className={styles.avatarLarge}
                                    />
                                    <span
                                        style={{
                                            fontWeight: 700,
                                            fontSize: 22,
                                        }}
                                    >
                                        {langManager.getData("name")}
                                    </span>
                                </Paper>
                            </Grid>

                            <Grid size={4} className={styles.flexColCenter}>
                                <Paper
                                    elevation={1}
                                    className={styles.roleCard}
                                >
                                    <div style={{ fontWeight: 600 }}>
                                        {langManager.getData(
                                            "software_engineer"
                                        )}
                                    </div>
                                    <div style={{ fontWeight: 600 }}>
                                        {langManager.getData("mlops")}
                                    </div>
                                </Paper>
                            </Grid>

                            <Grid size={12}>
                                <Paper
                                    elevation={3}
                                    className={styles.linkCard}
                                >
                                    <div>
                                        <Link
                                            href="https://github.com/skyser2003"
                                            rel="noopener"
                                            target="_blank"
                                            sx={{ fontWeight: 600 }}
                                        >
                                            GitHub
                                        </Link>
                                    </div>
                                    <div>
                                        <Link
                                            href="https://www.linkedin.com/in/skyser2003/"
                                            rel="noopener"
                                            target="_blank"
                                            sx={{ fontWeight: 600 }}
                                        >
                                            LinkedIn
                                        </Link>
                                    </div>
                                    <div>
                                        <Link
                                            href="https://onedrive.live.com/?cid=051065429517968a&id=051065429517968A!sf97af970a60940569b96e3831779c394&resid=051065429517968A!sf97af970a60940569b96e3831779c394&ithint=file,pdf&e=mrbR4m&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL2IvYy8wNTEwNjU0Mjk1MTc5NjhhL0VYRDVldmtKcGxaQW01YmpneGQ1dzVRQi1nS3ZCTWZEd1k4QUhsUzY2YmdMdGc_ZT1tcmJSNG0"
                                            rel="noopener"
                                            target="_blank"
                                            sx={{ fontWeight: 600 }}
                                        >
                                            Resume (English)
                                        </Link>
                                    </div>
                                    <div>
                                        <Link
                                            href="https://onedrive.live.com/?cid=051065429517968a&id=051065429517968A!scbf91e998a5a472695310f3085383c35&resid=051065429517968A!scbf91e998a5a472695310f3085383c35&ithint=file,pdf&e=wsD0KH&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL2IvYy8wNTEwNjU0Mjk1MTc5NjhhL0Vaa2UtY3RhaWlaSGxURVBNSVU0UERVQmVsMFR6SExJdXVDc1h1bl9UbE9WdEE_ZT13c0QwS0g"
                                            rel="noopener"
                                            target="_blank"
                                            sx={{ fontWeight: 600 }}
                                        >
                                            Resume (Korean)
                                        </Link>
                                    </div>
                                </Paper>
                            </Grid>
                        </Grid>
                        <Grid
                            size={4}
                            className={styles.simpleCard}
                            sx={{ backgroundColor: "background.paper" }}
                        >
                            <Grid container>
                                <Grid size={4}>
                                    {isDownloaded ? (
                                        <Button
                                            variant="contained"
                                            onClick={clearCache}
                                        >
                                            Clear Cache
                                        </Button>
                                    ) : isDownloading ? (
                                        <CircularProgress />
                                    ) : (
                                        !isDownloaded && (
                                            <Button
                                                variant="contained"
                                                onClick={downloadRepository}
                                            >
                                                Download
                                            </Button>
                                        )
                                    )}
                                </Grid>
                                <Grid size={8}></Grid>
                                <Grid size={8}>
                                    <Input
                                        id="prompt_input"
                                        placeholder="Enter your prompt"
                                        onKeyUp={onPressEnter}
                                    />
                                </Grid>
                                <Grid size={4}>
                                    <Button
                                        variant="contained"
                                        onClick={generateText}
                                    >
                                        Submit
                                    </Button>
                                </Grid>
                                <Grid size={12}>
                                    <Typography>
                                        <pre
                                            id="generated_text"
                                            style={{
                                                whiteSpace: "pre-wrap",
                                                wordWrap: "break-word",
                                                overflowWrap: "break-word",
                                            }}
                                        ></pre>
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Grid>
                        <Grid
                            size={4}
                            className={styles.simpleCard}
                            sx={{ backgroundColor: "background.paper" }}
                        >
                            b
                        </Grid>
                        <Grid
                            size={8}
                            className={styles.simpleCard}
                            sx={{ backgroundColor: "background.paper" }}
                        >
                            c
                        </Grid>
                    </Grid>
                </main>
            </div>
        </ThemeProvider>
    );
}
