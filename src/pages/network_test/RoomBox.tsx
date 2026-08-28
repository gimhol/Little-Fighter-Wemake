import { Button } from "@/Component/Buttons/Button";
import { Divider } from "@/Component/Divider";
import { Flex } from "@/Component/Flex";
import Frame from "@/Component/Frame";
import { Input } from "@/Component/Input";
import Show from "@/Component/Show";
import { Strong, Text } from "@/Component/Text";
import { useFloating } from "@/hooks/useFloating";
import { type IRoomInfo, MsgEnum } from "@/Net";
import type { IRoomClientInfo } from "@/Net/IRoomClientInfo";
import { useForwardedRef } from "@fimagine/dom-hooks";
import List from "rc-virtual-list";
import { type ForwardedRef, forwardRef, type HTMLAttributes, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Connection } from "./Connection";
import { useCallbacks } from "./useCallbacks";
import { useRoom } from "./useRoom";
export interface IRoomBoxProps extends HTMLAttributes<HTMLDivElement> {
  conn?: Connection | null
}
export function _RoomBox(props: IRoomBoxProps, f_ref: ForwardedRef<HTMLDivElement>) {
  const { conn, ..._p } = props;
  const { room } = useRoom(conn)
  const { players, me, owner, all_ready, is_owner } = useMemo(() => {
    const players = room?.clients ?? []
    const me = players.find(v => v.id == conn?.client?.id) || null;
    const owner = players.find(v => v.id == room?.owner?.id) || null;
    const all_ready = !!(
      !players.some(v => !v.ready) &&
      room?.min_players &&
      players.length >= room.min_players
    )
    return { players, me, owner, all_ready, is_owner: me === owner } as const
  }, [room])
  
  const [countdown, set_countdown] = useState(5);
  const [ref_floating_view, on_ref] = useForwardedRef(f_ref)
  useFloating({
    responser: ref_floating_view.current?.firstElementChild as HTMLElement,
    target: ref_floating_view.current,
    followPercent: true,
  })

  useEffect(() => {
    let sec = 5
    set_countdown(sec);
    if (!all_ready || !conn) return;
    const tid = setInterval(() => {
      sec -= 1;
      set_countdown(sec);
      if (sec > 0) return;

      clearInterval(tid);
      if (is_owner)
        conn?.send(MsgEnum.RoomStart, {})
    }, 1000)
    return () => clearInterval(tid)
  }, [all_ready, conn, is_owner])

  const { t } = useTranslation()
  return (
    <Frame {..._p} ref={on_ref}>
      <Flex direction='column' align='stretch'>
        <Flex gap={10} align='center' justify='space-between' style={{ margin: 5 }}>
          <Strong>{`${room?.title} (${players?.length}/${room?.max_players})`}</Strong>
        </Flex>
        <Divider />
        <Show show={!!room?.lfw_version || !!room?.data_infos?.length}>
          <Flex direction='column' align='stretch' gap={2} style={{ margin: '0 5px 5px' }}>
            {
              room?.lfw_version ?
                <Text size='s' style={{ opacity: 0.8 }}>{t('lfw_version')}: {room.lfw_version}</Text> :
                null
            }
            {
              room?.data_infos?.map((info, i) =>
                <Text key={i} size='ss' style={{ opacity: 0.8, wordBreak: 'break-all' }}>
                  {t('data_package')}[{i + 1}] {info.type ? `[${info.type}]` : ''} {info.title ?? ''}{typeof info.version === 'number' ? ` v${info.version}` : ''}{info.md5 ? ` · ${info.md5}` : ''}
                </Text>
              )
            }
          </Flex>
          <Divider />
        </Show>
        {
          room?.owner?.id === conn?.client?.id ?
            <>
              <Input
                size='s'
                prefix={t('password')}
                variants={['no_border']}
                placeholder={t('dont_need_password')}
                onBlur={e => conn?.send(MsgEnum.RoomPwd, { pwd: e.target.value?.trim() })}
              />
              <Divider />
            </> : null
        }
      </Flex>
      <List data={players} itemKey={r => r.id!} styles={{ verticalScrollBarThumb: { backgroundColor: 'rgba(255,255,255,0.3)' } }}>
        {m => <RoomMemberRow member={m} conn={conn} room={room} />}
      </List>
      {
        all_ready ?
          <Flex direction='row' align='stretch' justify='space-evenly' gap={5} style={{ margin: 5 }}>
            {t("counting_down").replace('%1', "" + countdown)}
          </Flex> : null
      }
      <Flex direction='row' align='stretch' justify='space-evenly' gap={5} style={{ margin: 5 }}>
        <Button
          variants={['no_border', 'no_round', 'no_shadow']}
          onClick={() => conn?.send(MsgEnum.ExitRoom, {})}>
          <Text> {t('leave_room')} </Text>
        </Button>
        <Button
          variants={['no_border', 'no_round', 'no_shadow']}
          onClick={() => conn?.send(MsgEnum.ClientReady, { ready: !me?.ready })}>
          {me?.ready ? t('cancal_ready') : t('get_ready')}
        </Button>
      </Flex>
    </Frame>
  )
}

interface IRoomMemberRowProps {
  member: Required<IRoomClientInfo>;
  conn?: Connection | null;
  room?: IRoomInfo | null;
}
function RoomMemberRow(props: IRoomMemberRowProps) {
  const { t } = useTranslation();
  const ref_rtt = useRef<HTMLSpanElement | null>(null)
  const { member, conn, room } = props
  const is_self = member.id === conn?.client?.id;

  useCallbacks(conn?.callbacks, {
    on_ping: (resp, conn) => {
      if (resp.client !== member.id) return
      const el = ref_rtt.current;
      if (!el) return;
      if (resp.client === conn.client?.id)
        el.innerText = `${conn.rtt}ms`
      else if (typeof resp.rtt === 'number')
        el.innerText = `${resp.rtt}ms`
    }
  }, [member.id])

  const { me, owner } = useMemo(() => {
    const players = room?.clients ?? []
    const me = players.find(v => v.id == conn?.client?.id) || null;
    const owner = players.find(v => v.id == room?.owner?.id) || null;
    return { me, owner } as const
  }, [room])

  return (
    <Flex direction='column' align='stretch' gap={5}>
      <Flex gap={10} align='center' justify='space-between' style={{ margin: 5 }}>
        <Text>
          {member.name}
        </Text>
        <Text ref={ref_rtt} />
        <Text style={{ opacity: 0.5, verticalAlign: 'middle' }}>
          {is_self ? `(${t('yourself')})` : ''}
          {member.id == room?.owner?.id ? '👑' : ''}
        </Text>
        <Flex align='center'>
          <Show show={owner?.id === me?.id && !is_self}>
            <Button
              variants={['no_border', 'no_round', 'no_shadow']}
              onClick={() => conn?.send(MsgEnum.Kick, { client_id: member.id })}>
              {t('kick')}
            </Button>
          </Show>
          <Text> {member.ready ? t('ready_completed') : t('not_ready')} </Text>
        </Flex>
      </Flex>
      <Divider />
    </Flex>
  )
}
export const RoomBox = forwardRef<HTMLDivElement, IRoomBoxProps>(_RoomBox)

