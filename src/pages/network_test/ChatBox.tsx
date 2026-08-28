
import { useFloating } from "@/hooks/useFloating";
import { useForwardedRef, useShortcut, useStateRef } from "@fimagine/dom-hooks";
import List, { type ListRef } from "rc-virtual-list";
import {
  type CSSProperties, type ForwardedRef, type ReactNode,
  forwardRef, useEffect, useMemo, useRef, useState
} from "react";
import { Button } from "../../Component/Buttons/Button";
import Combine from "../../Component/Combine";
import { Flex, type IFlexProps } from "../../Component/Flex";
import { Input, type InputRef } from "../../Component/Input";
import { type IRespChat, MsgEnum } from "../../Net";
import { Connection } from "./Connection";
import styles from "./styles.module.scss";
import { useRoom } from "./useRoom";
export const enum ChatTarget {
  Global = 'global',
  Room = 'room',
  Private = 'private',
}
export const chat_target_labels = {
  [ChatTarget.Global]: "全局",
  [ChatTarget.Room]: "房间",
  [ChatTarget.Private]: "私聊"
} as const
export const all_chat_targets: [ChatTarget, ReactNode][] = [
  [ChatTarget.Global, '全局'],
  [ChatTarget.Room, '房间']
]
export interface IChatBoxProps extends IFlexProps {
  conn?: Connection | null;
}
const list_styles = { verticalScrollBarThumb: { backgroundColor: 'rgba(255,255,255,0.3)' } }
const msg_item_height = parseInt(styles.msg_item_height);
const msg_list_height = 240;
function _ChatBox(props: IChatBoxProps, fref: ForwardedRef<HTMLDivElement>) {
  const { conn = null, ..._p } = props;
  const { room } = useRoom(conn)
  const chat_targets = useMemo(() => {
    if (room) return all_chat_targets;
    return all_chat_targets.filter(v => v[0] !== 'room')
  }, [!room])
  const ref_input = useRef<InputRef>(null);
  const [chat_target, set_chat_target, ref_chat_target] = useStateRef(ChatTarget.Global);
  const [chat_msg_text, set_chat_msg_text] = useStateRef<string>('');
  const [chat_msg_sending, set_chat_msg_sending] = useStateRef<boolean>(false);
  const [msgs, set_msgs, ref_msgs] = useStateRef<IRespChat[]>([]);
  const [is_bottom, set_is_bottom] = useStateRef(true)
  const ref_list = useRef<ListRef>(null)
  useEffect(() => {
    set_chat_target(r => {
      if (r === ChatTarget.Private) return r
      else if (room) return ChatTarget.Room;
      else return ChatTarget.Global;
    })
  }, [room])
  useEffect(() => {
    if (!room && chat_target === ChatTarget.Room)
      set_chat_target(ChatTarget.Global)
  }, [!room, chat_target]);

  useEffect(() => {
    if (!conn) return;
    const cancel = conn.callbacks.add({
      on_message: (resp) => {
        switch (resp.type) {
          case MsgEnum.Chat:
            const list = ref_list.current;
            if (!list) break;
            const { y } = ref_list.current!.getScrollInfo()
            const dist_to_bottom = msg_item_height * msgs.length - y - msg_list_height
            set_is_bottom(dist_to_bottom < 20)
            set_msgs(v => [...v.slice(-100), resp]);
            break;
        }
      }
    })
    return () => cancel()
  }, [conn])

  const send = () => {
    if (!conn) return;
    set_chat_msg_sending(true)
    conn.send(MsgEnum.Chat, {
      target: chat_target,
      text: chat_msg_text.trim()
    }).then(r => {
      set_chat_msg_text('');
    }).catch(e => {

    }).finally(() => {
      set_chat_msg_sending(false)
    })
  }

  const switch_chat_target = () => {
    const idx = chat_targets.findIndex(i => i[0] === ref_chat_target.current)
    const [next] = chat_targets[(idx + 1) % chat_targets.length]
    set_chat_target(next);
    ref_input.current?.input?.focus();
  }
  useShortcut('alt+y', conn != null, switch_chat_target, window)
  useShortcut('alt+t', conn != null, () => ref_input.current?.input?.focus(), window)
  useEffect(() => {
    if (!is_bottom) return;
    const list = ref_list.current;
    if (!list) return;
    list.scrollTo(Number.MAX_SAFE_INTEGER)
  }, [is_bottom, msgs])

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
        data={msgs}
        ref={ref_list}
        height={Math.min(msg_list_height, msg_item_height * msgs.length)}
        styles={list_styles}
        itemHeight={msg_item_height}
        itemKey={i => '' + i.seq}>
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
      <Combine className={styles.input_row}>
        <Input
          ref={ref_input}
          disabled={chat_msg_sending}
          maxLength={100}
          data-flex={1}
          onFocus={e => set_ipt_focus(true)}
          onBlur={e => set_ipt_focus(false)}
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

export const ChatBox = forwardRef<HTMLDivElement, IChatBoxProps>(_ChatBox)