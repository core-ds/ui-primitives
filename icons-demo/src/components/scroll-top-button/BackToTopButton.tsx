import React, { useEffect, useState } from 'react';
import cn from 'classnames';
import { IconButton } from '@alfalab/core-components/icon-button/modern';
import { ArrowUpMIcon } from '@alfalab/icons-glyph/ArrowUpMIcon';

import style from './index.module.css';

type BackToTopProps = {
    onClick: () => void;
    visible: boolean;
};

export const BackToTopButton: React.FC<BackToTopProps> = ({ onClick, visible }) => {
    const [show, setShow] = useState(visible);
    const [transitionClass, setTransitionClass] = useState<boolean>(false);

    useEffect(() => {
        let timer: number;

        if (visible) {
            setShow(true);
            timer = window.setTimeout(() => setTransitionClass(true), 50);
        } else {
            timer = window.setTimeout(() => setShow(false), 300);
            setTransitionClass(false);
        }

        return () => clearTimeout(timer);
    }, [visible]);

    return show ? (
        <IconButton
            icon={ArrowUpMIcon}
            className={cn(style.button, {
                [style.appear]: transitionClass,
            })}
            colors="inverted"
            onClick={onClick}
        />
    ) : null;
};
