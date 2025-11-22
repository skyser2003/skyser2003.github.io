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
    Select,
    MenuItem,
} from "@mui/material";
import { green } from "@mui/material/colors";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";

import langManager from "@/models/language/lang_manager";
import { WorkerSendMessageType, WorkerReceiveMessageType } from "./worker_enum";

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
    const [repository, setRepository] = React.useState(
        "timinar/baby-llama-58m"
    );
    // Generation parameter states
    const [temperature, setTemperature] = React.useState(1.0);
    const [topK, setTopK] = React.useState<number | string>(10);
    const [topP, setTopP] = React.useState<number | string>(0.1);
    const [sampleLen, setSampleLen] = React.useState(128);

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
                        case WorkerSendMessageType.WorkerReady:
                            {
                                localWorker.postMessage({
                                    type: WorkerReceiveMessageType.CheckModel,
                                });
                            }
                            break;
                        case WorkerSendMessageType.ModelChecked:
                            {
                                setIsModelChecked(true);
                                setIsDownloaded(value);
                            }
                            break;

                        case WorkerSendMessageType.SetIsDownloading:
                            {
                                setIsDownloading(value);
                            }
                            break;

                        case WorkerSendMessageType.SetIsDownloaded:
                            {
                                setIsDownloaded(value);
                            }
                            break;

                        case WorkerSendMessageType.RepositorySet:
                            {
                                setIsModelChecked(false);
                                setIsDownloaded(false);
                            }
                            break;

                        case WorkerSendMessageType.DataLoaded:
                            {
                                setIsDownloading(false);
                                setIsDownloaded(true);
                            }
                            break;

                        case WorkerSendMessageType.TextGenerated:
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

                        case WorkerSendMessageType.TextGenerateDone:
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
        worker!.postMessage({ type: WorkerReceiveMessageType.ClearCache });
    }

    async function downloadRepository() {
        setIsDownloading(true);
        worker!.postMessage({ type: WorkerReceiveMessageType.LoadData });
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

        const args = {
            temperature,
            top_k: topK === "" ? null : topK,
            top_p: topP === "" ? null : topP,
            sample_len: sampleLen,
        };

        worker!.postMessage({
            type: WorkerReceiveMessageType.GenerateText,
            value: {
                prompt,
                args,
            },
        });
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
                                            href="/pdf/resume_eng.pdf"
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
                                            href="/pdf/resume_kor.pdf"
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
                                <Grid size={8}>
                                    <Select
                                        size="small"
                                        value={repository}
                                        onChange={(e) => {
                                            const repo = e.target
                                                .value as string;
                                            setRepository(repo);
                                            if (worker) {
                                                worker.postMessage({
                                                    type: WorkerReceiveMessageType.SetRepository,
                                                    value: repo,
                                                });
                                                worker.postMessage({
                                                    type: WorkerReceiveMessageType.CheckModel,
                                                });
                                            }
                                        }}
                                        sx={{ minWidth: 260 }}
                                    >
                                        <MenuItem value="timinar/baby-llama-58m">
                                            timinar/baby-llama-58m
                                        </MenuItem>
                                    </Select>
                                </Grid>
                                <Grid size={12}>
                                    <Paper
                                        elevation={1}
                                        style={{ padding: 8, marginTop: 12 }}
                                    >
                                        <Typography
                                            variant="subtitle2"
                                            gutterBottom
                                        >
                                            Generation Params
                                        </Typography>
                                        <div
                                            style={{
                                                display: "flex",
                                                flexWrap: "wrap",
                                                gap: 8,
                                            }}
                                        >
                                            <label style={{ fontSize: 12 }}>
                                                Temp
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min={0}
                                                    style={{ width: 70 }}
                                                    value={temperature}
                                                    onChange={(e) =>
                                                        setTemperature(
                                                            parseFloat(
                                                                e.target.value
                                                            ) || 0
                                                        )
                                                    }
                                                />
                                            </label>
                                            <label style={{ fontSize: 12 }}>
                                                top_k
                                                <input
                                                    type="number"
                                                    min={0}
                                                    style={{ width: 70 }}
                                                    value={topK}
                                                    onChange={(e) => {
                                                        const v =
                                                            e.target.value;
                                                        setTopK(
                                                            v === ""
                                                                ? ""
                                                                : parseInt(v)
                                                        );
                                                    }}
                                                />
                                            </label>
                                            <label style={{ fontSize: 12 }}>
                                                top_p
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min={0}
                                                    max={1}
                                                    style={{ width: 70 }}
                                                    value={topP}
                                                    onChange={(e) => {
                                                        const v =
                                                            e.target.value;
                                                        setTopP(
                                                            v === ""
                                                                ? ""
                                                                : parseFloat(v)
                                                        );
                                                    }}
                                                />
                                            </label>
                                            <label style={{ fontSize: 12 }}>
                                                length
                                                <input
                                                    type="number"
                                                    min={1}
                                                    style={{ width: 70 }}
                                                    value={sampleLen}
                                                    onChange={(e) =>
                                                        setSampleLen(
                                                            parseInt(
                                                                e.target.value
                                                            ) || 1
                                                        )
                                                    }
                                                />
                                            </label>
                                        </div>
                                    </Paper>
                                </Grid>
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
                                    <Typography component="div">
                                        <pre
                                            id="generated_text"
                                            style={{
                                                whiteSpace: "pre-wrap",
                                                wordWrap: "break-word",
                                                overflowWrap: "break-word",
                                                margin: 0,
                                            }}
                                        ></pre>
                                    </Typography>
                                    <Typography
                                        component="span"
                                        id="generated_text_tail"
                                    ></Typography>
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
