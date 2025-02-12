import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Dispatch, SetStateAction } from "react"

export type TimePeriod = string | number

interface TimeSelectorProps {
    selectedTime: TimePeriod
    setSelectedTime: Dispatch<SetStateAction<TimePeriod>>
}

export default function TimeSelector({ selectedTime, setSelectedTime }: TimeSelectorProps) {
    return (
        <div className="inline-flex border rounded-md p-1 max-h-[50px] max-w-[220px]">
            <ToggleGroup
                type="single"
                value={selectedTime.toString()}
                onValueChange={(value: any) => value && setSelectedTime(value)}
                className="space-x-1"
            >
                <ToggleGroupItem
                    value="12h"
                    variant="default"
                    className="border-0 bg-transparent text-sm px-3 py-1"
                >
                    12h
                </ToggleGroupItem>
                <ToggleGroupItem
                    value="24h"
                    variant="default"
                    className="border-0 bg-transparent text-sm px-3 py-1"
                >
                    24h
                </ToggleGroupItem>
                <ToggleGroupItem
                    value="3d"
                    variant="default"
                    className="border-0 bg-transparent text-sm px-3 py-1"
                >
                    3d
                </ToggleGroupItem>
                <ToggleGroupItem
                    value="1w"
                    variant="default"
                    className="border-0 bg-transparent text-sm px-3 py-1"
                >
                    1w
                </ToggleGroupItem>
            </ToggleGroup>
        </div>
    )
}

