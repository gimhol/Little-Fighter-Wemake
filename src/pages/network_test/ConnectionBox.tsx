import { Button } from "@/Component/Buttons/Button";
import type { ICombineProps } from "@/Component/Combine";
import { Flex } from "@/Component/Flex";
import Frame from "@/Component/Frame";
import { Input } from "@/Component/Input";
import { Text } from "@/Component/Text";
import { useForage } from "@/hooks/useForage";
import { LFW } from "@/LFW";
import { useFloating } from "@/hooks/useFloating";
import { useForwardedRef } from "@fimagine/dom-hooks/dist/useForwardedRef";
import { useStateRef } from "@fimagine/dom-hooks/dist/useStateRef";
import { type ForwardedRef, forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Connection } from "./Connection";
import { TriState } from "./TriState";
import { useCallbacks } from "./useCallbacks";

export interface IConnectionBoxProps extends ICombineProps {
  on_conn_change?(conn: Connection | null): void;
  on_state_change?(conn_state: TriState): void;
  lf2?: LFW | null;
}
function _ConnectionBox(props: IConnectionBoxProps, f_ref: ForwardedRef<HTMLDivElement>) {
  const { t } = useTranslation();
  const { on_state_change, on_conn_change, lf2, ..._p } = props;
  const [ref, on_ref] = useForwardedRef(f_ref)
  const ref_responser = useRef<HTMLSpanElement>(null)
  useFloating({
    target: ref.current,
    responser: ref_responser.current,
    pivot_x: 0,
    pivot_y: 1,
    followPercent: true,
    is_excluded: e => {
      return e.tagName === 'INPUT' || e.classList.contains(`rc-virtual-list-scrollbar-thumb`)
    }
  })
  const [conn, set_conn, ref_conn] = useStateRef<Connection | null>(null)
  const [address, set_address] = useStateRef('lfj.gim.ink')
  const [nickname, set_nickname, nickname_ready] = useForage({ key: 'nickname', init: '' })
  const [conn_state, set_connected] = useState<TriState>(TriState.False);
  const ref_on_state_change = useRef(on_state_change);
  ref_on_state_change.current = on_state_change;
  const ref_on_conn_change = useRef(on_conn_change);
  ref_on_conn_change.current = on_conn_change;
  useMemo(() => ref_on_conn_change.current?.(conn), [conn])
  useMemo(() => ref_on_state_change.current?.(conn_state), [conn_state])

  useEffect(() => {
    if (!lf2 || !nickname_ready) return;
    const players = [
      lf2.players.get('1'),
      lf2.players.get('2'),
      lf2.players.get('3'),
      lf2.players.get('4'),
    ]
    const player = players.find((p, i) => {
      if (!p) return false;
      return p.name.trim() && p.name !== `${i + 1}`
    })
    if (player) set_nickname(prev => prev || player.name)
  }, [lf2, nickname_ready])

  function connect() {
    if (ref_conn.current) return;
    const conn = new Connection(nickname);
    set_conn(conn);
  }
  useCallbacks(conn?.callbacks, {
    on_register: () => {
      set_connected(TriState.True)
    },
    on_close: () => {
      set_connected(TriState.False)
      set_conn(null)
    }
  })

  useEffect(() => {
    if (!conn || !address) return;
    set_connected(TriState.Pending);
    conn.open(`${address}`)
    return () => conn?.close()
  }, [conn])

  return (
    <Frame  {..._p} ref={on_ref}>

      <Text size='s' style={{ padding: '2px 5px' }} ref={ref_responser}>
        {t('connect_box')}
      </Text>
      <Input
        style={{ width: '100%' }}
        value={address}
        onChange={set_address}
        disabled={!!conn_state}
        data-flex={1}
        variants={['no_border']}
        prefix={<Text size='s'>{t('address')}:</Text>}
        onKeyDown={e => e.stopPropagation()}
      />
      <Flex>
        <Input
          variants={['no_border']}
          style={{ flex: 1 }}
          value={nickname}
          onChange={set_nickname}
          disabled={!!conn_state}
          data-flex={1}
          prefix={<Text size='s'>{t("nickname")}:</Text>}
          onKeyDown={e => e.stopPropagation()}
        />
        <Button
          variants={['no_border']}
          disabled={conn_state === TriState.Pending || !address.trim()}
          onClick={connect}>
          {{
            [TriState.False]: t('connect'),
            [TriState.Pending]: t('connecting') + '...',
            [TriState.True]: t('disconnect'),
          }[conn_state]}
        </Button>
      </Flex>
    </Frame>
  )
}
export const ConnectionBox = forwardRef<HTMLDivElement, IConnectionBoxProps>(_ConnectionBox)

