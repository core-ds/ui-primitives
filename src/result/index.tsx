import { useRef, useState } from "react";
import { Toast } from "@alfalab/core-components/toast";
import { CopyLineMIcon } from "@alfalab/icons-glyph/CopyLineMIcon";
import { IconButton } from "@alfalab/core-components/icon-button";
import copy from "copy-to-clipboard";

import "./index.css";
import { Typography } from "@alfalab/core-components/typography";

type Props = {
    label?: string;
    value: string;
};

export function Result({ label, value }: Props) {
    const [copyToastOpen, setCopyToastOpen] = useState<boolean>(false);
    const copyRef = useRef<HTMLButtonElement>(null);

    const handleCopy = () => {
        setCopyToastOpen(true);

        copy(value);
    };

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
                    ref={copyRef}
                />
            </div>

            <Toast
                open={copyToastOpen}
                anchorElement={copyRef.current}
                position="right"
                offset={[0, 24]}
                title="Скопировано"
                hasCloser={false}
                block={false}
                onClose={() => {
                    setCopyToastOpen(false);
                }}
                autoCloseDelay={1500}
            />
        </>
    );
}
