import { Input, type InputRef } from "@/Component/Input";
import { LFW } from "@/LFW";
import { useFloating, useForwardedRef, useStateRef } from "@fimagine/dom-hooks";
import classNames from "classnames";
import List from "rc-virtual-list";
import { type ForwardedRef, forwardRef, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../Component/Buttons/Button";
import { Divider } from "../../Component/Divider";
import { Flex } from "../../Component/Flex";
import Frame, { type IFrameProps } from "../../Component/Frame";
import Show from "../../Component/Show";
import { Strong, Text } from "../../Component/Text";
import { type IRoomInfo, MsgEnum } from "../../Net";
import { Connection } from "./Connection";
import styles from "./styles.module.scss";
import { TriState } from "./TriState";
import { useCallbacks } from "./useCallbacks";
import { useRoom } from "./useRoom";
import { useRooms } from "./useRooms";

export interface IRoomsBoxProps extends IFrameProps {
  conn?: Connection | null;
  conn_state?: TriState;
  lf2?: LFW | null;
}
function _RoomsBox(props: IRoomsBoxProps, f_ref: ForwardedRef<HTMLDivElement>) {
  const { t } = useTranslation()
  const {
    conn = null,
    conn_state = TriState.False,
    className,
    lf2,
    ..._p
  } = props;

  const [room_creating, set_room_creating, ref_room_creating] = useStateRef<boolean>(false);
  const [room_joining, set_room_joining, ref_room_joining] = useStateRef<boolean>(false);
  const { room } = useRoom(conn)
  const { rooms } = useRooms(conn)
  const cls_name = classNames(styles.rooms_box, className)
  const update_rooms = useCallback(() => {
    if (!conn) return;
    conn.send(MsgEnum.ListRooms, {}, { loose: true }).catch(e => { })
  }, [conn])

  const ref_rtt = useRef<HTMLSpanElement>(null)
  useCallbacks(conn?.callbacks, {
    on_ping: (resp, conn) => {
      if (resp.client !== conn.client?.id) return;
      const el = ref_rtt.current;
      if (el) el.innerText = `${conn.rtt}ms`
    }
  }, [])

  useEffect(() => {
    if (!conn || conn_state !== TriState.True || room)
      return;
    update_rooms();
    const c = conn.callbacks.add({
      on_message: (resp) => {
        switch (resp.type) {
          case MsgEnum.ExitRoom:
          case MsgEnum.Kick:
            update_rooms();
            break;
          case MsgEnum.CloseRoom:
            update_rooms();
            break;
        }
      }
    });
    return () => c()
  }, [conn, conn_state === TriState.True, room])

  function get_version_info() {
    return {
      lfw_version: LFW.VERSION_NAME,
      data_infos: LFW.DATA_INFOS,
    }
  }

  function create_room() {
    if (
      ref_room_joining.current ||
      ref_room_creating.current
    ) return;
    if (!conn) return;
    set_room_creating(true)
    conn.send(MsgEnum.CreateRoom, {
      min_players: 1,
      max_players: 4,
      ...get_version_info(),
    }).then((resp) => {
      update_rooms()
    }).catch(e => {
      console.log(e)
    }).finally(() => {
      set_room_creating(false)
    })
  }

  function join_room(roomid: string, pwd?: string) {
    if (
      !conn ||
      ref_room_joining.current ||
      ref_room_creating.current
    ) return;
    set_room_joining(true)
    conn.send(MsgEnum.JoinRoom, { roomid, pwd, ...get_version_info() }).catch(e => {
      alert('' + e)
    }).finally(() => {
      set_room_joining(false)
    })
  }
  const [ref_floating_view, on_ref] = useForwardedRef(f_ref)
  useFloating({
    responser: ref_floating_view.current?.firstElementChild as HTMLElement,
    target: ref_floating_view.current,
    followPercent: true,
  })
  return (
    <Frame {..._p} className={cls_name} ref={on_ref}>
      <Flex gap={10} align='stretch' justify='space-between'>
        <Flex align='center' style={{ flex: 1, paddingLeft: 5, overflow: 'hidden' }} gap={5}>
          <Strong style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
            {t('room_list')}
          </Strong>
          <Text style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
            {conn?.url}
          </Text>
          <Text ref={ref_rtt} />
        </Flex>
        <Flex>
          <Show show={!room && conn_state && !room_joining && !room_creating}>
            <Button
              variants={['no_border', 'no_round', 'no_shadow']}
              onClick={() => create_room()}>
              {t('create_room')}
            </Button>
          </Show>
          <Button
            variants={['no_border', 'no_round', 'no_shadow']}
            onClick={() => update_rooms()} >
            {t('refresh')}
          </Button>
          <Button
            variants={['no_border', 'no_round', 'no_shadow']}
            onClick={() => conn?.close()} >
            {t('disconnect')}
          </Button>
        </Flex>
      </Flex>
      {rooms?.length === 0 ?
        <Flex direction='column' align='center' justify='center' style={{ height: 65, opacity: 0.5 }}>
          <Text style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
            {t('no_rooms')}
          </Text>
        </Flex> : <Divider />
      }
      <List
        data={rooms}
        itemKey={r => r.id!}
        itemHeight={65}
        style={{ flex: 1, overflow: 'auto' }}>
        {(r, i) => <RoomItem
          room={r}
          conn={conn}
          index={i}
          rooms={rooms}
          key={`room_${i}`}
          join_room={join_room} />}
      </List>
    </Frame>
  )
}

interface IRoomItemProps {
  room: IRoomInfo;
  rooms: IRoomInfo[];
  index: number;
  conn: Connection | null;
  join_room(id: string, pwd?: string): void
}
function RoomItem(props: IRoomItemProps) {
  const { t } = useTranslation()
  const { room: r, join_room, rooms, index, conn } = props;
  const ref_input = useRef<InputRef>(null);
  const { room } = useRoom(conn)
  if (!conn) return;
  return <>
    <Flex direction='column' align='stretch' gap={5}>
      <Flex gap={10} direction='column' align='stretch' justify='space-between'
        style={{ padding: 5, boxSizing: 'border-box', height: 64 }}>
        <Flex gap={10} align='center'>
          <Strong> {t('room_name')}: {r.title} </Strong>
          <Text> {t('player_count')}: {r.clients?.length}/{r.max_players} </Text>
          {
            r.lfw_version || r.data_infos?.length ?
              <Text
                size='ss'
                title={`${r.lfw_version ?? ''}${r.data_infos?.length ? '\n' + r.data_infos.map(v => `${v.type ?? ''} ${v.title ?? ''}${typeof v.version === 'number' ? ' v' + v.version : ''} ${v.md5 ?? ''}`).join('\n') : ''}`}
                style={{ opacity: 0.6, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 130 }}>
                {r.lfw_version}{r.data_infos?.length ? ` · ${t('data_package')}×${r.data_infos.length}` : ''}
              </Text> :
              null
          }
        </Flex>
        <Flex gap={10}>
          <Text style={{ flex: 1, display: 'flex' }} >
            {
              r.need_pwd ? <Input
                prefix="🔒"
                style={{ flex: 1 }}
                variants={['no_border']}
                size='s'
                placeholder={t('pls_enter_pwd')}
                ref={ref_input} /> :
                null
            }
          </Text>
          <Button
            variants={['no_border', 'no_round', 'no_shadow']}
            disabled={!!room || r.started}
            onClick={() => join_room(r.id!, ref_input.current?.value?.toString() || void 0)}>
            {r.started ? t("game_running") : t("join")}
          </Button>
        </Flex>
      </Flex>
    </Flex>
    <Divider />
    <Show show={index == rooms.length - 1}>
      <Flex direction='column' align='center' justify='center' style={{ opacity: 0.5, padding: 10 }}>
        <Text style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
          {t('load_finished')}
        </Text>
      </Flex>
    </Show>
  </>
}

export const RoomsBox = forwardRef<HTMLDivElement, IRoomsBoxProps>(_RoomsBox)

