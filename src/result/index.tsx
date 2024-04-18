import { Toast } from "@alfalab/core-components/toast";
import { CopyLineMIcon } from "@alfalab/icons-glyph/CopyLineMIcon";
import { IconButton } from "@alfalab/core-components/icon-button";

import "./index.css";
import { Typography } from "@alfalab/core-components/typography";
import {useResult} from "./hooks/useResult.tsx";

type Props = {
    label?: string;
    value: string;
};

export function Result({ label, value }: Props) {
    const {copyToastOpen, handleCopy, closeCopyToast} = useResult(value);

    return (
        <>
            <div className="result">
                <div>
                    {label && (
                        <Typography.Text view="primary-small" color="secondary" className="label">
                            {label}
                        </Typography.Text>
                    )}

                    <Typography.Text view="primary-small" className="value">
                        {value}
                    </Typography.Text>
                </div>

                <IconButton
                    icon={CopyLineMIcon}
                    view="secondary"
                    className="copy"
                    onClick={handleCopy}
                />
            </div>

            <Toast
                open={copyToastOpen}
                title="Скопировано"
                hasCloser={false}
                block={false}
                style={{ left: '50%', transform: 'translateX(-50%)' }}
                onClose={closeCopyToast}
                autoCloseDelay={1500}
            />
        </>
    );
}
