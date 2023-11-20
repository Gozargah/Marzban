import {FC} from "react";

type UserStatusProps = {
    lastOnline?: string | null;
};

const convertDateFormat = (lastOnline: string | null | undefined): number | null => {
    if (!lastOnline) {
        return null;
    }

    const date = new Date(lastOnline + "Z");
    return Math.floor(date.getTime() / 1000);
};

export const OnlineBadge: FC<UserStatusProps> = ({lastOnline}) => {
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    const unixTime = convertDateFormat(lastOnline);

    if (typeof lastOnline === 'undefined' || lastOnline === null) {
        return <div className="circle pulse orange"></div>;
    }

    const timeDifferenceInSeconds = unixTime ? currentTimeInSeconds - unixTime : Infinity;

    if (timeDifferenceInSeconds > 0 && timeDifferenceInSeconds <= 60) {
        return <div className="circle pulse green"></div>;
    }

    return <div className="circle pulse red"></div>;
};