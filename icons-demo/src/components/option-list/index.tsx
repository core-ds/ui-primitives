import React, { FC } from 'react';
import { BaseOption, OptionsList } from '@alfalab/core-components/select/modern/shared';

import { noop } from '../../shared/utils';
import { getOptionsList } from './OptionList';
import { IconCardData } from '../../types';

type Props = {
    data: IconCardData;
    onClick: (key: string, value: string) => void;
};

export const IconCardOptionsList: FC<Props> = (props) => {
    const { data, onClick: handleClick } = props;
    const options = getOptionsList(data);

    return (
        <OptionsList
            options={options}
            Option={BaseOption}
            setSelectedItems={noop}
            toggleMenu={noop}
            optionsListWidth="field"
            getOptionProps={(option, index) => {
                const { key, value } = option;

                return {
                    Checkmark: null,
                    index,
                    option,
                    className: 'option',
                    optionsListWidth: 'field',
                    innerProps: {
                        id: key,
                        onClick: () => {
                            handleClick(key, value);
                        },
                    },
                };
            }}
        />
    );
};
