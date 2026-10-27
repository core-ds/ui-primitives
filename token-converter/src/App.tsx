import { FC, useMemo, useState } from 'react';
import { TitleDesktop, TitleMobile } from '@alfalab/core-components/typography';
import { SegmentedControl, Segment } from '@alfalab/core-components/segmented-control';
import { Input } from '@alfalab/core-components/input';
import { convert } from './converter';
import { useMatchMedia } from '@alfalab/core-components/mq';
import { Result } from './result';

const BREAKPOINT = 600;

import './App.css';

const App: FC = () => {
    const [isDesktop] = useMatchMedia(`(min-width: ${BREAKPOINT}px)`);
    const [platform, setPlatform] = useState<Platform>('web');
    const [style, setStyle] = useState<string>('');
    const { token, error, hint } = useMemo(() => {
        try {
            const token = convert(style, platform);

            return token ? { token } : { hint: 'Такого токена не существует' };
        } catch (e) {
            return { error: e instanceof Error ? e.message : 'Ошибка' };
        }
    }, [platform, style]);
    const Title = isDesktop ? TitleDesktop : TitleMobile;

    return (
        <div className="wrapper">
            <Title view="xlarge" tag="h1" className="title">
                Конвертер токенов
            </Title>

            <div className="filters">
                <SegmentedControl
                    size={32}
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
                size={48}
                placeholder="Скопируйте сюда название токена из макета"
                value={style}
                onChange={(_, payload) => setStyle(payload.value)}
                clear
                onClear={() => setStyle('')}
                hint={style && hint}
                error={style && error}
            />

            {token?.type === 'color' && <Result value={token.name} />}

            {token?.type === 'typography' && platform === 'web' && (
                <div className="results">
                    <Result label="Component.Typography" value={token.nameComponentTypography} />

                    <Result label="Component.Text" value={token.nameComponentText} />

                    <Result label="Mixin" value={token.nameMixin} />
                </div>
            )}

            {token?.type === 'typography' && platform !== 'web' && <Result value={token.name} />}
        </div>
    );
};

export default App;
