import React, { FC } from 'react';
import cn from 'classnames';
import { Typography } from '@alfalab/core-components/typography';
import { ArrowRightCurvedMIcon } from '@alfalab/icons-glyph/ArrowRightCurvedMIcon';

type Props = {
    text: string;
    replace: boolean;
};

export const OptionContentDeprecated: FC<Props> = ({ text, replace }) => (
    <div
        className={cn('option-content', {
            'option-no-replace': !replace,
        })}
    >
        <Typography.Text
            view={replace ? 'component-primary' : 'primary-small'}
            color={replace ? 'primary' : 'tertiary'}
        >
            {text}
        </Typography.Text>

        {replace && <ArrowRightCurvedMIcon color="var(--color-light-graphic-tertiary)" />}
    </div>
);
