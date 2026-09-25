import React from "react"
import type { RouteObject } from "react-router"
export namespace Paths {
  export enum All {
    _ = '',
    game = '/',
    editor = '/editor',
    bdy_editor = '/bdy_editor',
    itr_editor = '/itr_editor',
    frame_editor = '/frame_editor',
    network_test = '/network_test',
    workspaces_demo = '/workspaces',
    component_demos = '/component_demos',
    component_demos_InputNumber = '/component_demos/InputNumber',
    component_demos_index = '/component_demos/*',
    component_demos_Button = "/component_demos/Button",
    component_demos_Combine = "/component_demos/Combine",
    component_demos_Select = "/component_demos/Select",
    component_demos_Input = "/component_demos/Input",
    component_demos_Icon = "/component_demos/Icon",
    component_demos_Tag = "/component_demos/Tag",
    component_demos_Checkbox = "/component_demos/Checkbox",
    component_demos_Divider = "/component_demos/Divider",
    component_demos_Flex = "/component_demos/Flex",
    component_demos_Form = "/component_demos/Form",
    component_demos_TabButtons = "/component_demos/TabButtons",
    component_demos_Text = "/component_demos/Text",
    component_demos_TextArea = "/component_demos/TextArea",
    component_demos_Titled = "/component_demos/Titled",
    dat_viewer = "/dat_viewer",
    custom_game = "/custom_game",
    bg_preview = "/bg_preview",

    EntityInfoFormDemo = '/EntityInfoFormDemo',
    ArmorInfoFormDemo = '/ArmorInfoFormDemo',
    DrinkInfoFormDemo = '/DrinkInfoFormDemo',
    FrameInfoFormDemo = '/FrameInfoFormDemo',
    ChaseInfoFormDemo = '/ChaseInfoFormDemo',
    BdyInfoFormDemo = '/BdyInfoFormDemo',
    ItrInfoFormDemo = '/ItrInfoFormDemo',
    WpointInfoFormDemo = '/WpointInfoFormDemo',
    BpointInfoFormDemo = '/BpointInfoFormDemo',
    OpointInfoFormDemo = '/OpointInfoFormDemo',
    CpointInfoFormDemo = '/CpointInfoFormDemo',
  }
  export const Components: Record<All, React.ComponentType | null> = {
    [All._]: null,
    [All.game]: React.lazy(() => import("./App")),
    [All.editor]: React.lazy(() => import("./Editor")),
    [All.component_demos]: React.lazy(() => import("./pages/component_demos")),
    [All.component_demos_index]: () => <></>,
    [All.component_demos_InputNumber]: React.lazy(() => import("./pages/component_demos/InputNumberDemo")),
    [All.component_demos_Button]: React.lazy(() => import("./pages/component_demos/ButtonDemo")),
    [All.component_demos_Combine]: React.lazy(() => import("./pages/component_demos/CombineDemo")),
    [All.component_demos_Select]: React.lazy(() => import("./pages/component_demos/SelectDemo")),
    [All.component_demos_Input]: React.lazy(() => import("./pages/component_demos/InputDemo")),
    [All.component_demos_Icon]: React.lazy(() => import("./pages/component_demos/IconDemo")),
    [All.component_demos_Tag]: React.lazy(() => import("./pages/component_demos/TagDemo")),
    [All.component_demos_Checkbox]: React.lazy(() => import("./pages/component_demos/CheckboxDemo")),
    [All.component_demos_Divider]: React.lazy(() => import("./pages/component_demos/DividerDemo")),
    [All.component_demos_Flex]: React.lazy(() => import("./pages/component_demos/FlexDemo")),
    [All.component_demos_Form]: React.lazy(() => import("./pages/component_demos/FormDemo")),
    [All.component_demos_TabButtons]: React.lazy(() => import("./pages/component_demos/TabButtonsDemo")),
    [All.component_demos_Text]: React.lazy(() => import("./pages/component_demos/TextDemo")),
    [All.component_demos_TextArea]: React.lazy(() => import("./pages/component_demos/TextAreaDemo")),
    [All.component_demos_Titled]: React.lazy(() => import("./pages/component_demos/TitledDemo")),
    [All.workspaces_demo]: React.lazy(() => import("./pages/workspaces_demo")),
    [All.network_test]: React.lazy(() => import("./pages/network_test")),
    [All.bdy_editor]: React.lazy(() => import("./EditorView/FrameEditorView/BdyEditor")),
    [All.itr_editor]: React.lazy(() => import("./EditorView/FrameEditorView/ItrEditor")),
    [All.frame_editor]: React.lazy(() => import("./EditorView/FrameEditorView")),
    [All.dat_viewer]: React.lazy(() => import("./pages/dat_viewer")),
    [All.custom_game]: React.lazy(() => import("./pages/custom_game")),
    [All.bg_preview]: React.lazy(() => import("./pages/bg_preview")),
    [All.EntityInfoFormDemo]: React.lazy(() => import("./EditorView/EntityInfoForm/demo")),
    [All.ArmorInfoFormDemo]: React.lazy(() => import("./EditorView/EntityInfoForm/ArmorInfoForm/demo")),
    [All.DrinkInfoFormDemo]: React.lazy(() => import("./EditorView/EntityInfoForm/DrinkInfoForm/demo")),
    [All.FrameInfoFormDemo]: React.lazy(() => import("./EditorView/FrameInfoForm/demo")),
    [All.ChaseInfoFormDemo]: React.lazy(() => import("./EditorView/FrameInfoForm/ChaseInfoForm/demo")),
    [All.BdyInfoFormDemo]: React.lazy(() => import("./EditorView/FrameInfoForm/BdyInfoForm/demo")),
    [All.ItrInfoFormDemo]: React.lazy(() => import("./EditorView/FrameInfoForm/ItrInfoForm/demo")),
    [All.WpointInfoFormDemo]: React.lazy(() => import("./EditorView/FrameInfoForm/WpointInfoForm/demo")),
    [All.BpointInfoFormDemo]: React.lazy(() => import("./EditorView/FrameInfoForm/BpointInfoForm/demo")),
    [All.OpointInfoFormDemo]: React.lazy(() => import("./EditorView/FrameInfoForm/OpointInfoForm/demo")),
    [All.CpointInfoFormDemo]: React.lazy(() => import("./EditorView/FrameInfoForm/CpointInfoForm/demo")),
  }
  export const Relations: { [x in All]?: All[] } = {
    [All._]: [
      All.game,
      All.component_demos,
      All.editor,
      All.workspaces_demo,
      All.network_test,
      All.bdy_editor,
      All.itr_editor,
      All.frame_editor,
      All.dat_viewer,
      All.custom_game,
      All.bg_preview,
      All.EntityInfoFormDemo,
      All.ArmorInfoFormDemo,
      All.DrinkInfoFormDemo,
      All.FrameInfoFormDemo,
      All.ChaseInfoFormDemo,
      All.BdyInfoFormDemo,
      All.ItrInfoFormDemo,
      All.WpointInfoFormDemo,
      All.BpointInfoFormDemo,
      All.OpointInfoFormDemo,
      All.CpointInfoFormDemo,
    ],
    [All.component_demos]: [
      All.component_demos_InputNumber,
      All.component_demos_Button,
      All.component_demos_Combine,
      All.component_demos_Select,
      All.component_demos_Input,
      All.component_demos_index,
      All.component_demos_Icon,
      All.component_demos_Tag,
      All.component_demos_Checkbox,
      All.component_demos_Divider,
      All.component_demos_Flex,
      All.component_demos_Form,
      All.component_demos_TabButtons,
      All.component_demos_Text,
      All.component_demos_TextArea,
      All.component_demos_Titled,
    ]
  }

  export const gen_route_obj = (path: All, parent?: All): RouteObject => {
    let str_path: string = path
    if (parent !== void 0) {
      if (path.startsWith(parent)) {
        str_path = path.replace(parent, '')
      }
      str_path = str_path.replace(/^\/(.*?)/, (_, a) => a)
    }
    const Component = Components[path] || (() => `component set as ${Components[path]}`);
    const ret: RouteObject = {
      path: str_path,
      element: (
        <React.Suspense>
          <Component />
        </React.Suspense>
      )
    }
    if (Relations[path]) {
      ret.children = Relations[path].map((child_path) => gen_route_obj(child_path, path))
    }
    return ret;
  }
  export const Routes: RouteObject[] = Paths.Relations[Paths.All._]!.map(c => gen_route_obj(c))
}