import React, { FC } from 'react';
import { Typography } from '@alfalab/core-components/typography';
import { CopyLineMIcon } from '@alfalab/icons-glyph/CopyLineMIcon';

type Props = {
    text: string;
};

export const OptionContentCopy: FC<Props> = ({ text }) => (
    <div className="option-content">
        <Typography.Text view="component-primary" color="primary">
            {text}
        </Typography.Text>

        <CopyLineMIcon />
    </div>
);
