import React, { FC, Fragment, memo, useRef, useState } from 'react';
import cn from 'classnames';

import { Typography } from '@alfalab/core-components/typography';
import { Popover } from '@alfalab/core-components/popover';
import { useClickOutside } from '@alfalab/hooks';

import { COLUMNS_AMOUNT } from '../../const/columns';
import { IconCardData, IconPackageName, RenderIconParams } from '../../types';
import { MetaInfo } from '../../shared/config/types';
import { getDeprecatedAssets } from '../../shared/helpers';
import { IconCardOptionsList } from '../option-list';

import styles from './index.module.css';

const ALL_DEPRECATED_ICONS = getDeprecatedAssets();

interface Props extends Pick<MetaInfo, 'middle'>, Pick<RenderIconParams, 'Icon'> {
    packageName: IconPackageName;
    dropDownData: IconCardData;
    onOptionClick: (key: string, value: string) => void;
}

export const IconCard: FC<Props> = memo((props) => {
    const { packageName, middle, Icon, dropDownData, onOptionClick } = props;

    const isWhite = middle.includes('white');
    const isDeprecatedIcon = ALL_DEPRECATED_ICONS.hasOwnProperty(middle);

    const popoverRef = useRef<HTMLDivElement>(null);
    const popoverAnchorRef = useRef<HTMLDivElement>(null);
    const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

    // @ts-expect-error
    useClickOutside(popoverRef, () => setPopoverOpen(false));

    const handleClick = () => {
        setPopoverOpen(true);
    };

    const handleSelect = () => {
        setPopoverOpen(false);
    };

    return (
        <Fragment>
            <div
                ref={popoverAnchorRef}
                className={cn('icon-wrap', `icon-wrap-column-${COLUMNS_AMOUNT}`, {
                    'icon-wrap_dark': isWhite,
                })}
                key={`${packageName}-${middle}`}
                onClick={handleClick}
            >
                {isDeprecatedIcon && (
                    <Typography.Text
                        tag="div"
                        view="primary-small"
                        color={isWhite ? 'tertiary-inverted' : 'tertiary'}
                        className={cn('deprecated', {
                            deprecated_dark: isWhite,
                        })}
                    >
                        deprecated
                    </Typography.Text>
                )}
                <Icon
                    className="icon"
                    color={
                        isDeprecatedIcon ? 'var(--color-light-graphic-tertiary)' : 'var(--color-light-graphic-primary)'
                    }
                />
                <Typography.Text
                    view="primary-small"
                    color={isWhite ? 'secondary-inverted' : 'secondary'}
                    className="icon-primitive-name"
                >
                    {middle}
                </Typography.Text>
            </div>
            <Popover
                open={popoverOpen}
                useAnchorWidth={true}
                anchorElement={popoverAnchorRef.current || null}
                popperClassName={styles.popperClassName}
                position="bottom"
                offset={[0, 4]}
                preventFlip={false}
                ref={popoverRef}
            >
                <IconCardOptionsList
                    data={dropDownData}
                    onClick={(key, value) => {
                        onOptionClick(key, value);
                        handleSelect();
                    }}
                />
            </Popover>
        </Fragment>
    );
});
