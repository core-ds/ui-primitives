import React, { FC, useCallback, useMemo, useRef, useState } from 'react';
import cn from 'classnames';
import { useVirtualizer } from '@tanstack/react-virtual';
import copy from 'copy-to-clipboard';

import { SelectDesktopProps } from '@alfalab/core-components/select/desktop';
import { Toast } from '@alfalab/core-components/toast/modern';

import { Asset, CopyType, DeprecatedType, IconPackageName } from '../types';
import { BackToTopButton } from './scroll-top-button/BackToTopButton';
import { getPackageNameAsset } from '../shared/utils';

import './Demo.css';
import { COLUMNS_AMOUNT } from '../const/columns';
import { IconCard } from './icon-card';
import { buildGrid } from './build-grid';
import { PackageName } from './package-name';
import { EmptyResult } from './empty-result';
import { Header } from './header';

const estimateDesktopSize = () => 192;
const getDefaultPackage = (asset: Asset) => getPackageNameAsset(asset) as IconPackageName;

const Demo: FC = () => {
    const [value, setValue] = useState<string>('');

    const [selectedPackages, setSelectedPackages] = useState<IconPackageName[]>([IconPackageName.GLYPH]);

    const [asset, setAsset] = useState<Asset>(Asset.ICONS);
    const [toastParams, setToastParams] = useState({ open: false, text: '' });

    const scrollerRef = useRef<HTMLDivElement>(null);

    const query = value.toLowerCase();

    const handleOptionItemClick = useCallback((type: string, value: string) => {
        if (type === DeprecatedType.DEPRECATED && value) {
            setValue(value);

            const replacePackage = value.split('_')[0] as IconPackageName;

            setSelectedPackages((prev) => (prev.includes(replacePackage) ? prev : [...prev, replacePackage]));

            return;
        }

        copy(value);

        setToastParams({
            open: true,
            text: type === CopyType.WEB_COMPONENT ? 'Код скопирован' : 'Имя скопировано',
        });
    }, []);

    const handlePackageChange = useCallback((payload: { checked: boolean; name?: string }) => {
        if (!payload.name) return;

        const packageName = payload.name as IconPackageName;

        setSelectedPackages((prev) =>
            payload.checked
                ? prev.includes(packageName)
                    ? prev
                    : [...prev, packageName]
                : prev.filter((item) => item !== packageName)
        );
    }, []);

    const handleAssetChange = useCallback<NonNullable<SelectDesktopProps['onChange']>>((payload) => {
        const nextAsset = payload.selected?.key as Asset;

        setSelectedPackages([getDefaultPackage(nextAsset)]);
        setAsset(nextAsset);
    }, []);

    const grid = useMemo(() => buildGrid({ selectedPackages, query }), [selectedPackages, query]);

    const virtualizer = useVirtualizer({
        count: grid.length,
        getScrollElement: () => scrollerRef.current,
        overscan: 5,
        estimateSize: estimateDesktopSize,
    });

    const items = virtualizer.getVirtualItems();

    return (
        <div className="root">
            <div ref={scrollerRef} className="list-scroller">
                <Header
                    value={value}
                    asset={asset}
                    selectedPackages={selectedPackages}
                    onSetValue={setValue}
                    onAssetChange={handleAssetChange}
                    onPackageChange={handlePackageChange}
                />

                <div className="list-scroller-inner" style={{ height: virtualizer.getTotalSize() }}>
                    <div className="icons-list" style={{ transform: `translateY(${items[0]?.start ?? 0}px)` }}>
                        {items.map((virtualRow) => {
                            const row = grid[virtualRow.index];
                            const isTitleRow = row.type === 'title';
                            const isIconsRow = row.type === 'icons';
                            const isEmptyRow = row.type === 'empty';

                            return (
                                <div
                                    key={row.key}
                                    className={cn({
                                        ['list-package-name']: isTitleRow,
                                        ['list-row']: isIconsRow,
                                        [`list-row-${COLUMNS_AMOUNT}`]: isIconsRow,
                                    })}
                                    data-index={virtualRow.index}
                                    ref={virtualizer.measureElement}
                                >
                                    {isTitleRow && <PackageName packageName={row.packageName} />}
                                    {isEmptyRow && <EmptyResult />}
                                    {isIconsRow &&
                                        row.items.map(({ middle, packageName, Icon, dropDownData }) => (
                                            <IconCard
                                                key={middle}
                                                packageName={packageName}
                                                middle={middle}
                                                Icon={Icon}
                                                dropDownData={dropDownData}
                                                onOptionClick={handleOptionItemClick}
                                            />
                                        ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <Toast
                title={toastParams.text}
                open={toastParams.open}
                onClose={() => setToastParams((prev) => ({ ...prev, open: false }))}
                style={{ left: '50%', transform: 'translateX(-53%)' }}
            />

            <BackToTopButton
                visible={items.length > 0 && items[0].index !== 0}
                onClick={() => scrollerRef.current?.scrollTo({ behavior: 'smooth', top: 0 })}
            />
        </div>
    );
};

export default Demo;
