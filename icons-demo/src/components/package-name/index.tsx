import React, { FC } from 'react';
import { Typography } from '@alfalab/core-components/typography';

import { formatPackageName } from '../../shared/utils';
import { Asset, IconPackageName } from '../../types';

interface Props {
    packageName: IconPackageName | Asset;
}

export const PackageName: FC<Props> = ({ packageName }) => {
    return (
        <Typography.Title tag="h3" view="small">
            {formatPackageName(packageName)}
        </Typography.Title>
    );
};
