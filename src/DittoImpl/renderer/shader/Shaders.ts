import ModelOutline from './model_outline.frag'
import ModelOutlineVert from './model_outline.vert'
import Normal from './normal.vert'
import Outline from './outline.frag'
import Text from './text.frag'
export const Shaders = {
  Fragment: {
    ModelOutline,
    Outline,
    Text
  },
  Vertex: {
    ModelOutline: ModelOutlineVert,
    Normal
  }
} as const;