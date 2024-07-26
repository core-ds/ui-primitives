import { useEffect, useState } from "react";
import { Typography } from "@alfalab/core-components/typography";
import { SegmentedControl, Segment } from "@alfalab/core-components/segmented-control";
import { Input } from "@alfalab/core-components/input";
import { convert } from "./converter";
import { useMatchMedia } from "@alfalab/core-components/mq";
import { Result } from "./result";

const BREAKPOINT = 600;

import "./App.css";

function App() {
    const [platform, setPlatform] = useState<Platform>("web");
    const [style, setStyle] = useState<string>("");
    const [hint, setHint] = useState<string>("");
    const [token, setToken] = useState<Token>();
    const [error, setError] = useState<string>("");

    const [isDesktop] = useMatchMedia(`(min-width: ${BREAKPOINT}px)`);

    useEffect(() => {
        setToken(undefined);
        setError("");
        setHint("");

        if (!style) {
            return;
        }

        try {
            const converted = convert(style, platform);
            if (converted) {
                setToken(converted);
                setHint("");
            } else {
                setHint("Такого токена не существует");
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка");
        }
    }, [platform, style]);

    const Title = isDesktop ? Typography.Title : Typography.TitleMobile;

    return (
        <div className="wrapper">
            <Title view="xlarge" tag="h1" className="title">
                Конвертер токенов
            </Title>

            <div className="filters">
                <SegmentedControl
                    size="xxs"
                    onChange={(id) => setPlatform(id as Platform)}
                    selectedId={platform}
                    className="platforms"
                >
                    <Segment id="web" title="Web" />
                    <Segment id="ios" title="iOS" />
                    <Segment id="android" title="Android" />
                </SegmentedControl>
            </div>

            <Input
                className="style"
                block
                size="s"
                placeholder="Скопируйте сюда название токена из макета"
                value={style}
                onChange={(_, payload) => setStyle(payload.value)}
                clear
                onClear={() => setStyle("")}
            />

            {hint && (
                <Typography.Text view="primary-small" color="secondary" className="hint">
                    {hint}
                </Typography.Text>
            )}

            {error && (
                <Typography.Text view="primary-small" color="negative" className="error">
                    {error}
                </Typography.Text>
            )}

            {token?.type === "color" && <Result value={token.name} />}

            {token?.type === "typography" && platform === "web" && (
                <div className="results">
                    <Result label="Component.Typography" value={token.nameComponentTypography} />

                    <Result label="Component.Text" value={token.nameComponentText} />

                    <Result label="Mixin" value={token.nameMixin} />
                </div>
            )}

            {token?.type === "typography" && platform !== "web" && <Result value={token.name} />}
        </div>
    );
}

export default App;
