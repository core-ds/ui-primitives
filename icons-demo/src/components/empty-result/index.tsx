import React from 'react';
import { Typography } from '@alfalab/core-components/typography';

import styles from './index.module.css';

export const EmptyResult = () => {
    return (
        <Typography.Text tag="div" view="primary-small" color="secondary" className={styles.text}>
            Ничего не нашлось, попробуйте изменить запрос
        </Typography.Text>
    );
};
