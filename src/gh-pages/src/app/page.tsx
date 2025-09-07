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
                github: {
                    main: "#181717",
                    contrastText: "#ffffff",
                },
                linkedin: {
                    main: "#0A66C2",
                    contrastText: "#ffffff",
                },
                pdf: {
                    main: "#D32F2F",
                    contrastText: "#ffffff",
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
                github: {
                    main: "#e6edf3",
                    contrastText: "#0d1117",
                },
                linkedin: {
                    main: "#4C8ED6",
                    contrastText: "#0d1117",
                },
                pdf: {
                    main: "#EF5350",
                    contrastText: "#0d1117",
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
    const [isWasmLoaded, setIsWasmLoaded] = React.useState(false);
    const [isModelChecked, setIsModelChecked] = React.useState(false);
    const [isDownloading, setIsDownloading] = React.useState(false);
    const [isDownloaded, setIsDownloaded] = React.useState(false);
    const [worker, setWorker] = React.useState<Worker | null>(null);

    if (language === "") {
        setLanguage(langManager.getLanguage());
    }

    React.useEffect(() => {
        const loadModule = async () => {
            const localWorker = new Worker(
                new URL("worker.ts", import.meta.url),
                {
                    type: "module",
                }
            );

            let generatedTextElement: HTMLElement | null = null;

            let generatedTextTailElement: HTMLElement | null = null;

            localWorker.onmessage = (event) => {
                const { data } = event;
                const value = data.value;

                (async () => {
                    switch (data.type) {
                        case "worker_ready":
                            {
                                localWorker.postMessage({
                                    type: "check_model",
                                });
                            }
                            break;
                        case "model_checked":
                            {
                                setIsModelChecked(true);
                                setIsDownloaded(true);
                            }
                            break;

                        case "set_isdownloaded":
                            {
                                setIsDownloaded(value);
                            }
                            break;

                        case "data_loaded":
                            {
                                setIsDownloading(false);
                                setIsDownloaded(true);
                            }
                            break;

                        case "text_generated":
                            {
                                if (generatedTextElement === null) {
                                    generatedTextElement =
                                        document.getElementById(
                                            "generated_text"
                                        )!;
                                }

                                if (generatedTextTailElement === null) {
                                    generatedTextTailElement =
                                        document.getElementById(
                                            "generated_text_tail"
                                        )!;
                                }

                                generatedTextElement.textContent += value;
                                generatedTextTailElement.textContent =
                                    "[continue...]";
                            }
                            break;

                        case "text_generate_done":
                            {
                                if (generatedTextTailElement === null) {
                                    generatedTextTailElement =
                                        document.getElementById(
                                            "generated_text_tail"
                                        )!;
                                }

                                generatedTextTailElement.textContent = "[done]";
                                console.log("Text generation done");
                            }
                            break;
                    }
                })();
            };

            setWorker(localWorker);
            setIsWasmLoaded(true);
        };

        loadModule();
    }, []);

    if (!isWasmLoaded || !isModelChecked || !worker) {
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

    async function clearCache() {
        worker!.postMessage({ type: "clear_cache" });
    }

    async function downloadRepository() {
        setIsDownloading(true);
        worker!.postMessage({ type: "load_data" });
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
        const generatedTextTailElement = document.getElementById(
            "generated_text_tail"
        )!;

        const prompt = promptInputElement.value;

        if (prompt.trim() === "") {
            return;
        }

        promptInputElement.value = "";
        generatedTextElement.textContent = `${prompt}`;
        generatedTextTailElement.textContent = "[waiting...]";

        worker!.postMessage({ type: "generate_text", value: prompt });
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
                                    <div className={styles.linkRow}>
                                        <Link
                                            href="https://github.com/skyser2003"
                                            rel="noopener"
                                            target="_blank"
                                            sx={{
                                                fontWeight: 600,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 1,
                                                color: "github.main",
                                            }}
                                        >
                                            <span
                                                className={`${styles.icon} ${styles.iconGithub}`}
                                                aria-hidden="true"
                                            ></span>
                                            GitHub
                                        </Link>
                                    </div>
                                    <div className={styles.linkRow}>
                                        <Link
                                            href="https://www.linkedin.com/in/skyser2003/"
                                            rel="noopener"
                                            target="_blank"
                                            sx={{
                                                fontWeight: 600,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 1,
                                                color: "linkedin.main",
                                            }}
                                        >
                                            <span
                                                className={`${styles.icon} ${styles.iconLinkedin}`}
                                                aria-hidden="true"
                                            ></span>
                                            LinkedIn
                                        </Link>
                                    </div>
                                    <div className={styles.linkRow}>
                                        <Link
                                            href="https://onedrive.live.com/?cid=051065429517968a&id=051065429517968A!sf97af970a60940569b96e3831779c394&resid=051065429517968A!sf97af970a60940569b96e3831779c394&ithint=file,pdf&e=mrbR4m&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL2IvYy8wNTEwNjU0Mjk1MTc5NjhhL0VYRDVldmtKcGxaQW01YmpneGQ1dzVRQi1nS3ZCTWZEd1k4QUhsUzY2YmdMdGc_ZT1tcmJSNG0"
                                            rel="noopener"
                                            target="_blank"
                                            sx={{
                                                fontWeight: 600,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 1,
                                                color: "pdf.main",
                                            }}
                                        >
                                            <span
                                                className={`${styles.icon} ${styles.iconPdf}`}
                                                aria-hidden="true"
                                            ></span>
                                            Resume (English)
                                        </Link>
                                    </div>
                                    <div className={styles.linkRow}>
                                        <Link
                                            href="https://onedrive.live.com/?cid=051065429517968a&id=051065429517968A!scbf91e998a5a472695310f3085383c35&resid=051065429517968A!scbf91e998a5a472695310f3085383c35&ithint=file,pdf&e=wsD0KH&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL2IvYy8wNTEwNjU0Mjk1MTc5NjhhL0Vaa2UtY3RhaWlaSGxURVBNSVU0UERVQmVsMFR6SExJdXVDc1h1bl9UbE9WdEE_ZT13c0QwS0g"
                                            rel="noopener"
                                            target="_blank"
                                            sx={{
                                                fontWeight: 600,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 1,
                                                color: "pdf.main",
                                            }}
                                        >
                                            <span
                                                className={`${styles.icon} ${styles.iconPdf}`}
                                                aria-hidden="true"
                                            ></span>
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
                                    <Typography id="generated_text_tail"></Typography>
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
