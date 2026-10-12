import { FC, SVGProps } from 'react';

import { IconCardData, IconPackageName } from '../types';
import { getDeprecatedAssets } from '../shared/helpers';
import { MetaInfo } from '../shared/config/types';
import { getKeyParts, getKeys } from '../shared/utils';
import { ICON_META_FILES, ICONS } from '../shared/config';
import { COLUMNS_AMOUNT } from '../const/columns';

const ALL_DEPRECATED_ASSETS = getDeprecatedAssets();

type IconGridItem = {
    middle: MetaInfo['middle'];
    packageName: IconPackageName;
    Icon: FC<SVGProps<SVGSVGElement>>;
    dropDownData: IconCardData;
    key: string;
};

type GridRow =
    | {
          type: 'title';
          key: string;
          packageName: IconPackageName;
      }
    | {
          type: 'icons';
          key: string;
          items: IconGridItem[];
      }
    | {
          type: 'empty';
          key: string;
      };

const chunkItems = <T>(items: T[], size: number) =>
    items.reduce<T[][]>((rows, item, index) => {
        const rowIndex = Math.floor(index / size);

        if (!rows[rowIndex]) {
            rows[rowIndex] = [];
        }

        rows[rowIndex].push(item);

        return rows;
    }, []);

export const buildGrid = ({
    selectedPackages,
    query,
}: {
    selectedPackages: IconPackageName[];
    query: string;
}): GridRow[] => {
    const grid = getKeys(ICONS).flatMap((packageName) => {
        if (!selectedPackages.includes(packageName)) {
            return [];
        }

        const module = ICONS[packageName];

        const icons = getKeys(module)
            .filter((reactIconName) => {
                const iconName = reactIconName.toLowerCase();
                const { description, middle } = ICON_META_FILES[packageName][reactIconName];

                return !query || iconName.includes(query) || middle.includes(query) || description.includes(query);
            })
            .map<IconGridItem>((reactIconName) => {
                const { description: _, middle, ...rest } = ICON_META_FILES[packageName][reactIconName];

                return {
                    middle,
                    packageName,
                    Icon: module[reactIconName],
                    dropDownData: {
                        packageName,
                        middle,
                        ...rest,
                    },
                    key: `${packageName}-${middle}`,
                };
            })
            .sort((a, b) => {
                const keyPartsA = getKeyParts(a.key);
                const keyPartsB = getKeyParts(b.key);

                if (ALL_DEPRECATED_ASSETS[keyPartsA]) {
                    return 1;
                }

                if (ALL_DEPRECATED_ASSETS[keyPartsB]) {
                    return -1;
                }

                return 0;
            });

        if (!icons.length) {
            return [];
        }

        return [
            ...(!query
                ? [
                      {
                          type: 'title' as const,
                          key: `title-${packageName}`,
                          packageName,
                      },
                  ]
                : []),
            ...chunkItems(icons, COLUMNS_AMOUNT).map((items, index) => ({
                type: 'icons' as const,
                key: `${packageName}-row-${index}`,
                items,
            })),
        ];
    });

    return query && grid.length === 0 ? [{ type: 'empty', key: 'empty-result' }] : grid;
};
