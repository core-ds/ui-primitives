import {useState} from "react";
import copy from "copy-to-clipboard";

type UseResult = {
    copyToastOpen: boolean;
    handleCopy: () => void;
    closeCopyToast: () => void;
}

export const useResult = (value: string): UseResult => {
    const [copyToastOpen, setCopyToastOpen] = useState<boolean>(false);

    const handleCopy = () => {
        setCopyToastOpen(true);

        copy(value);
    };

    const closeCopyToast = () => {
        setCopyToastOpen(false);
    }

    return {copyToastOpen, handleCopy, closeCopyToast}
}