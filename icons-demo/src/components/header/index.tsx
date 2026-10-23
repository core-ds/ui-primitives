import React, { FC, memo } from 'react';

import { Typography } from '@alfalab/core-components/typography';
import { Input } from '@alfalab/core-components/input';
import { SelectDesktop, SelectDesktopProps } from '@alfalab/core-components/select/desktop';
import { BaseOption } from '@alfalab/core-components/select/shared';
import { CheckboxGroup, CheckboxGroupProps } from '@alfalab/core-components/checkbox-group/modern';
import { Tag } from '@alfalab/core-components/tag';
import { MagnifierMIcon } from '@alfalab/icons-glyph/MagnifierMIcon';

import { ASSET_TO_PACKAGE_NAME } from '../../shared/constants';
import { getKeys, getPackageNameAsset } from '../../shared/utils';
import { Asset, IconPackageName } from '../../types';

import styles from './index.module.css';

const ASSET_OPTIONS = getKeys(Asset).map((key) => ({
    key: Asset[key],
    content: getPackageNameAsset(Asset[key], true),
}));

type Props = {
    value: string;
    asset: Asset;
    selectedPackages: IconPackageName[];
    onSetValue: (value: string) => void;
    onAssetChange: SelectDesktopProps['onChange'];
    onPackageChange: (args: Parameters<NonNullable<CheckboxGroupProps['onChange']>>[1]) => void;
};

export const Header: FC<Props> = memo((props) => {
    const { value, asset, selectedPackages, onSetValue, onAssetChange, onPackageChange } = props;

    return (
        <div className={styles.header}>
            <Typography.Title tag="h1" view="xlarge" font="styrene">
                Витрина ассетов
            </Typography.Title>

            <div className={styles.searchWrapper}>
                <Input
                    value={value}
                    className={styles.searchInput}
                    placeholder="Поиск по названию"
                    block={true}
                    leftAddons={<MagnifierMIcon />}
                    clear={true}
                    onChange={(e) => onSetValue(e.target.value)}
                    onClear={() => onSetValue('')}
                />
                <div className={styles.assetSelectWrapper}>
                    <SelectDesktop
                        options={ASSET_OPTIONS}
                        selected={asset}
                        Option={BaseOption}
                        block={true}
                        placeholder="Bundle"
                        size={48}
                        onChange={onAssetChange}
                    />
                </div>
            </div>

            {['icons', 'logotype'].includes(asset) ? (
                <CheckboxGroup
                    onChange={(_, payload) => onPackageChange(payload)}
                    direction="horizontal"
                    type="tag"
                    className={styles.bundleGroupWrapper}
                >
                    {ASSET_TO_PACKAGE_NAME[asset].map((assetItem) => (
                        <Tag
                            name={assetItem.value}
                            checked={selectedPackages.includes(assetItem.value)}
                            shape="rectangular"
                            value={assetItem.value}
                            key={assetItem.value}
                            view="filled"
                            size={32}
                        >
                            {assetItem.label}
                        </Tag>
                    ))}
                </CheckboxGroup>
            ) : null}
        </div>
    );
});
