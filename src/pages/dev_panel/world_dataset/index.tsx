import { Button } from "@/Component/Buttons/Button";
import Combine from "@/Component/Combine";
import { Cross } from "@/Component/Icons/Cross";
import { InputNumber } from "@/Component/Input";
import Titled from "@/Component/Titled";
import { type IWorldDataset, LFW, round, world_dataset_fields, WorldDataset } from "@/LFW";
import { download } from "@/Utils/download";
import { useEffect, useState } from "react";
import { useImmer } from "use-immer";
import csses from "./index.module.scss";

interface IWorldDatasetProps extends React.HTMLAttributes<HTMLDivElement> {
  lfw?: LFW | null;
}
export function WorldDatasetView(props: IWorldDatasetProps) {
  const { lfw } = props;

  const [dwds, set_dwds] = useImmer<Partial<IWorldDataset>>({})
  const [cwds, set_cwds] = useImmer<Partial<IWorldDataset>>({})
  const [ready, set_ready] = useState(false)

  useEffect(() => {
    if (!lfw?.world) return;
    if (!ready) return;
    Object.assign(lfw.world.dataset, cwds)
  }, [ready, cwds, lfw])

  useEffect(() => {
    if (!lfw?.world) return;
    set_dwds(d => {
      for (const [k] of world_dataset_fields) {
        const key = k as keyof IWorldDataset;
        (d as Record<string, unknown>)[key] = lfw.world.dataset[key]
      }
    })
    set_cwds(d => {
      for (const [k] of world_dataset_fields) {
        const key = k as keyof IWorldDataset;
        (d as Record<string, unknown>)[key] = lfw.world.dataset[key]
      }
    })
    set_ready(true);
  }, [lfw, set_dwds, set_cwds])


  const dump = () => {
    const json_blob = new Blob([
      JSON.stringify(
        {
          __is_world_dataset__: true,
          ...lfw?.world.dataset.dump_dataset(),
        }
      )], {
      type: 'application/json;charset=utf-8'
    })
    download(URL.createObjectURL(json_blob), 'world.wdataset.json')
  }
  return (
    <div className={csses.world_dataset}>
      {Array.from(world_dataset_fields.values()).map((v: any) => {

        // fix this 'as'!
        const { key, title = key, desc = title, type, step } = v;
        return (
          <Titled float_label={title} title={`[${key}]${desc}`} key={v.key}>
            <Combine>
              <InputNumber
                precision={type === 'float' ? 2 : 0}
                min={v.min}
                max={v.max}
                step={type === 'float' ? step : round(step ?? 1)}
                className={csses.num_input}
                value={(cwds as any)[v.key]}
                onChange={(v) => { set_cwds(d => { (d as any)[key] = v }) }} />
              <Button
                title="重置"
                onClick={(_) => set_cwds(d => { (d as any)[key] = (dwds as any)[key] })}>
                <Cross />
              </Button>
            </Combine>
          </Titled>
        );
      })}
      <Button disabled={!ready} onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dump()
      }}>
        Dump
      </Button>
      <Button disabled={!ready} onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        set_cwds((v) => v = { ...new WorldDataset(true) })
      }}>
        Reset
      </Button>
    </div>
  )
}