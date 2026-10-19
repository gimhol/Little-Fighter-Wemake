
import { useFloating } from "@/hooks/useFloating";
import { useForwardedRef } from "@/hooks/useForwardedRef";
import { useShortcut } from "@/hooks/useShortcut";
import { useStateRef } from "@/hooks/useStateRef";
import List, { type ListRef } from "rc-virtual-list";
import {
  type CSSProperties, type ForwardedRef, type ReactNode,
  forwardRef, useCallback, useEffect, useMemo, useRef, useState
} from "react";
import { Button } from "../../Component/Buttons/Button";
import Combine from "../../Component/Combine";
import { Flex, type IFlexProps } from "../../Component/Flex";
import { Input, type InputRef } from "../../Component/Input";
import { ErrCode, type IConnError, type IRespChat, MsgEnum } from "../../Net";
import { is_editing_element } from "../../Utils/is_editing_element";
import { Connection } from "./Connection";
import styles from "./styles.module.scss";
import { useRoom } from "./useRoom";
const enum ChatTarget {
  Global = 'global',
  Room = 'room',
  Private = 'private',
}
const chat_target_labels = {
  [ChatTarget.Global]: "全局",
  [ChatTarget.Room]: "房间",
  [ChatTarget.Private]: "私聊"
} as const
const all_chat_targets: [ChatTarget, ReactNode][] = [
  [ChatTarget.Global, '全局'],
  [ChatTarget.Room, '房间']
]
export interface IChatBoxProps extends IFlexProps {
  conn?: Connection | null;
}
const list_styles = { verticalScrollBarThumb: { backgroundColor: 'rgba(255,255,255,0.3)' } }
const msg_item_height = parseInt(styles.msg_item_height);
const msg_list_height = 240;
const CHAT_SEND_COOLDOWN_MS = 800;
const CHAT_RATE_LIMIT_BACKOFF_MS = 1200;
function ChatBoxView(props: IChatBoxProps, fref: ForwardedRef<HTMLDivElement>) {
  const { conn = null, ..._p } = props;
  const { room } = useRoom(conn)
  const ref_room = useRef(room);
  // eslint-disable-next-line react-hooks/refs
  ref_room.current = room;
  const chat_targets = useMemo(() => {
    if (room) return all_chat_targets.filter(v => v[0] === ChatTarget.Room);
    return all_chat_targets.filter(v => v[0] === ChatTarget.Global);
  }, [room])
  const ref_input = useRef<InputRef>(null);
  const [chat_target, set_chat_target, ref_chat_target] = useStateRef(ChatTarget.Global);
  const [chat_msg_text, set_chat_msg_text, ref_chat_msg_text] = useStateRef<string>('');
  const [chat_msg_sending, set_chat_msg_sending, ref_chat_msg_sending] = useStateRef<boolean>(false);
  const [msgs, set_msgs, ref_msgs] = useStateRef<IRespChat[]>([]);
  const [is_bottom, set_is_bottom] = useStateRef(true)
  const ref_list = useRef<ListRef>(null)
  const ref_chat_cooldown_until = useRef(0);
  useEffect(() => {
    set_chat_target(r => {
      if (r === ChatTarget.Private) return r
      else if (room) return ChatTarget.Room;
      else return ChatTarget.Global;
    })
  }, [room, set_chat_target])
  useEffect(() => {
    if (!room && chat_target === ChatTarget.Room)
      set_chat_target(ChatTarget.Global)
  }, [room, chat_target, set_chat_target]);

  useEffect(() => {
    if (!conn) return;
    const cancel = conn.callbacks.add({
      on_message: (resp) => {
        switch (resp.type) {
          case MsgEnum.Chat: {
            if (ref_room.current && resp.target === ChatTarget.Global) break;
            const list = ref_list.current;
            if (!list) break;
            const { y } = ref_list.current!.getScrollInfo()
            const visible_count = ref_msgs.current.filter(m =>
              !(ref_room.current && m.target === ChatTarget.Global)).length;
            const dist_to_bottom = msg_item_height * visible_count - y - msg_list_height
            set_is_bottom(dist_to_bottom < 20)
            set_msgs(v => [...v.slice(-100), resp]);
            break;
          }
        }
      }
    })
    return () => cancel()
  }, [conn, ref_msgs, set_is_bottom, set_msgs])

  const send = () => {
    if (!conn) return;
    if (ref_chat_msg_sending.current) return;
    const text = (ref_chat_msg_text.current ?? '').trim();
    if (!text) return;
    const now = Date.now();
    if (now < ref_chat_cooldown_until.current) return;
    ref_chat_cooldown_until.current = now + CHAT_SEND_COOLDOWN_MS;
    const input = ref_input.current?.input;
    const keep_focus = !!input && document.activeElement === input;
    set_chat_msg_sending(true)
    conn.send(MsgEnum.Chat, {
      target: ref_chat_target.current,
      text
    }).then(() => {
      set_chat_msg_text('');
    }).catch(e => {
      if ((e as IConnError)?.lfw?.code === ErrCode.ChatTooFrequent)
        ref_chat_cooldown_until.current = Date.now() + CHAT_RATE_LIMIT_BACKOFF_MS;
    }).finally(() => {
      set_chat_msg_sending(false)
      if (keep_focus && input && document.activeElement === document.body)
        input.focus();
    })
  }

  const [open_input, set_open_input] = useState(false)
  const open_input_box = useCallback(() => {
    set_open_input(true)
    setTimeout(() => ref_input.current?.input?.focus(), 0)
  }, [])
  const close_input_box = useCallback(() => {
    set_open_input(false)
    ref_input.current?.input?.blur()
  }, [])
  useEffect(() => {
    if (!conn) return
    const on_keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!open_input) return
        e.preventDefault(); e.stopImmediatePropagation()
        close_input_box()
        return
      }
      if (e.key !== 'Enter' || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return
      if (is_editing_element(e.target)) return
      e.preventDefault(); e.stopImmediatePropagation()
      open_input_box()
    }
    window.addEventListener('keydown', on_keydown, true)
    return () => window.removeEventListener('keydown', on_keydown, true)
  }, [conn, open_input, open_input_box, close_input_box])

  const switch_chat_target = () => {
    const idx = chat_targets.findIndex(i => i[0] === ref_chat_target.current)
    const [next] = chat_targets[(idx + 1) % chat_targets.length]
    set_chat_target(next);
    open_input_box()
  }
  useShortcut('alt+y', !conn, switch_chat_target, window)
  useShortcut('alt+t', !conn, open_input_box, window)
  const visible_msgs = useMemo(
    () => room ? msgs.filter(m => m.target !== ChatTarget.Global) : msgs,
    [msgs, room])

  useEffect(() => {
    if (!is_bottom) return;
    const list = ref_list.current;
    if (!list) return;
    list.scrollTo(Number.MAX_SAFE_INTEGER)
  }, [is_bottom, visible_msgs])

  let input_prefix_classname = styles.msg_item;
  switch (chat_target!) {
    case "global": input_prefix_classname = styles.color_global; break;
    case "room": input_prefix_classname = styles.color_room; break;
  }
  const [ipt_focus, set_ipt_focus] = useState(false)
  const [msg_list_style, set_msg_list_style] = useState<CSSProperties>()

  useEffect(() => {
    set_msg_list_style({ opacity: 1, pointerEvents: 'all' })
    if (ipt_focus) return;
    const tid = setTimeout(() => set_msg_list_style(void 0), 3000)
    return () => clearTimeout(tid)
  }, [msgs, ipt_focus])


  const [ref_floating_view, on_ref] = useForwardedRef(fref)
  useFloating({
    responser: ref_floating_view.current,
    pivot_x: 0,
    pivot_y: 1,
    followPercent: true,
    resizable: false,
    is_excluded: e => {
      return e.tagName === 'INPUT' || e.classList.contains(`rc-virtual-list-scrollbar-thumb`)
    }
  })
  return (
    <Flex direction='column' align='stretch' {..._p} ref={on_ref}>
      <List
        virtual
        className={styles.msg_list}
        style={msg_list_style}
        data={visible_msgs}
        ref={ref_list}
        height={Math.min(msg_list_height, msg_item_height * visible_msgs.length)}
        styles={list_styles}
        itemHeight={msg_item_height}
        itemKey={i => i.seq !== undefined ? '' + i.seq : `${i.date}:${i.sender?.id ?? ''}:${i.text}`}>
        {i => {
          let classname = styles.msg_item
          switch (i.target!) {
            case "global": classname = styles.msg_item_global; break;
            case "room": classname = styles.msg_item_room; break;
            case "private": classname = styles.msg_item_pri; break;
          }
          let name = i.sender?.name;
          if (i.sender?.id === conn?.client?.id)
            name = `[你]${name}`
          return (
            <div className={classname}>
              {`${name}: ${i.text}`}
            </div>
          )
        }}
      </List>
      <Combine className={`${styles.input_row}${open_input ? '' : ' ' + styles.input_row_hidden}`}>
        <Input
          ref={ref_input}
          maxLength={100}
          data-flex={1}
          onFocus={() => set_ipt_focus(true)}
          onBlur={e => {
            set_ipt_focus(false)
            const next = e.relatedTarget as Node | null
            if (next && ref_floating_view.current?.contains(next)) return
            if (!chat_msg_text.trim()) close_input_box()
          }}
          prefix={
            <Button
              variants={['no_border', 'no_round', 'no_shadow']}
              onClick={() => switch_chat_target()}
              size='s'>
              <span className={input_prefix_classname}>
                [{chat_target_labels[chat_target]}]
              </span>
            </Button>
          }
          placeholder="输入消息"
          onKeyUp={e => {
            if ('enter' === e.key?.toLowerCase())
              send();
          }}
          value={chat_msg_text}
          onChange={set_chat_msg_text} />
        <Button
          disabled={chat_msg_sending || !chat_msg_text.trim()}
          onClick={() => send()}>
          发送
        </Button>
      </Combine>
    </Flex>
  )
}

export const ChatBox = forwardRef<HTMLDivElement, IChatBoxProps>(ChatBoxView)