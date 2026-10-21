import React from 'react';

import { DeprecatedType, IconCardData } from '../../types';
import { OptionContentCopy } from './components/option-content-copy';
import { OptionContentDeprecated } from './components/option-content-deprecated';
import { exhaustiveCheck } from '../../shared/utils';
import { MetaOptions } from '../../shared/config/types';
import { getDeprecatedAssets } from '../../shared/helpers';

const ALL_DEPRECATED_ICONS = getDeprecatedAssets();

const getOption = (key: MetaOptions) => {
    switch (key) {
        case 'web':
            return <OptionContentCopy text="Веб имя иконки" />;
        case 'webComponent':
            return <OptionContentCopy text="Веб компонент" />;
        case 'android':
            return <OptionContentCopy text="Android имя иконки" />;
        case 'ios':
            return <OptionContentCopy text="iOS имя иконки" />;
        case 'middle':
            return <OptionContentCopy text="Мидл имя иконки" />;
        case 'cdn':
            return <OptionContentCopy text="CDN имя иконки" />;
        case 'url':
            return <OptionContentCopy text="URL иконки" />;
        default:
            return exhaustiveCheck(key);
    }
};

const getDeprecatedOptionWithReplace = (replaceValue: string) => {
    return [
        {
            key: DeprecatedType.DEPRECATED,
            content: <OptionContentDeprecated text="Перейти к замене" replace={true} />,
            value: replaceValue,
        },
    ];
};

const DEPRECATED_OPTION_WITHOUT_REPLACE = [
    {
        key: DeprecatedType.NO_REPLACE,
        content: (
            <OptionContentDeprecated
                text="Замены нет. Попробуйте найти другую иконку, подходящую под вашу задачу."
                replace={false}
            />
        ),
    },
];

const generateOptionList = (data: IconCardData) => {
    return Object.keys(data)
        .filter((item) => !['packageName', 'basename'].includes(item))
        .map((item) => {
            const key = item as MetaOptions;
            return {
                key,
                content: getOption(key),
                value: data[key],
            };
        });
};

export function getOptionsList(data: IconCardData) {
    const { middle } = data;
    if (!ALL_DEPRECATED_ICONS.hasOwnProperty(middle)) {
        return generateOptionList(data);
    } else if (ALL_DEPRECATED_ICONS[middle].replacement) {
        return getDeprecatedOptionWithReplace(ALL_DEPRECATED_ICONS[middle].replacement);
    } else {
        return DEPRECATED_OPTION_WITHOUT_REPLACE;
    }
}
