import UILangData from "@/data/lang_data.json";

const langCodeRegex = /^(.+)-.+$/;

class LanguageManager {
    private uiLangData: { [key: string]: { [key: string]: string } };

    constructor(private lang: string) {
        this.uiLangData = UILangData as {
            [key: string]: { [key: string]: string };
        };
    }

    public getData(key: string) {
        return this.uiLangData[key][this.lang];
    }

    public setLanguage(lang: string) {
        this.lang = lang;
    }

    public getLanguage() {
        return this.lang;
    }
}

let langCode = "en";

const langMatch = window.navigator.language.match(langCodeRegex);

if (langMatch !== null) {
    langCode = langMatch[1];
}

const lm = new LanguageManager(langCode);

export default lm;
