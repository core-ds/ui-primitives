import { useEffect, useRef, useState } from "react";
import { Toast } from "@alfalab/core-components/toast";
import { CopyLineMIcon } from "@alfalab/icons-glyph/CopyLineMIcon";
import { IconButton } from "@alfalab/core-components/icon-button";
import { Typography } from "@alfalab/core-components/typography";
import { Input } from "@alfalab/core-components/input";
import { SelectDesktop } from "@alfalab/core-components/select/desktop";
import copy from "copy-to-clipboard";
import "./App.css";
import { convert } from "./converter";

function App() {
    const [platform, setPlatform] = useState<Platform>("web");
    const [style, setStyle] = useState<string>("");
    const [hint, setHint] = useState<string>("");
    const [result, setResult] = useState<string>("");
    const [copyToastOpen, setCopyToastOpen] = useState<boolean>(false);
    const copyRef = useRef<HTMLButtonElement>(null);

    const handleCopy = () => {
        setCopyToastOpen(true);
        copy(result);
    };

    useEffect(() => {
        setResult("");

        if (!style) {
            setHint("");
            return;
        }

        try {
            setResult(convert(style, platform));
            setHint("");
        } catch (e) {
            console.error(e);
            setHint("Ничего не нашлось, похоже такого токена нет в core");
        }
    }, [platform, style]);

    return (
        <div className="wrapper">
            <Typography.TitleResponsive view="xlarge" tag="h1" className="title">
                Конвертер токенов
            </Typography.TitleResponsive>

            <div className="form">
                <Input
                    className="style"
                    block
                    size="m"
                    placeholder="Скопируйте сюда название токена из фигмы"
                    value={style}
                    onChange={(_, payload) => setStyle(payload.value)}
                    clear
                    onClear={() => setStyle("")}
                />

                <SelectDesktop
                    className="platform"
                    block
                    size="m"
                    placeholder="Выберите платформу"
                    selected={platform}
                    onChange={(payload) => payload.selected && setPlatform(payload.selected.key as Platform)}
                    options={[
                        { key: "web", content: "Web" },
                        { key: "mobile", content: "Mobile" },
                    ]}
                />
            </div>

            {hint && (
                <Typography.Text view="primary-small" color="secondary" className="hint">
                    {hint}
                </Typography.Text>
            )}

            {result && (
                <div className="result">
                    {result}
                    <IconButton icon={CopyLineMIcon} view="secondary" className="copy" onClick={handleCopy} ref={copyRef} />
                </div>
            )}

            <Toast
                open={copyToastOpen}
                anchorElement={copyRef.current}
                position="top"
                offset={[0, 8]}
                badge="positive"
                title="Скопировано"
                hasCloser={false}
                block={false}
                onClose={() => {
                    setCopyToastOpen(false);
                }}
                autoCloseDelay={1500}
            />
        </div>
    );
}

export default App;
