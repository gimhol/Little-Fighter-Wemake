import type { Rest } from '../index';
import { register_admin_page_routes } from './admin_page';
import { register_auth_routes } from './auth';
import { register_client_routes } from './clients';
import { register_me_routes } from './me';
import { register_rank_routes } from './ranks';
import { register_room_routes } from './rooms';
import { register_server_routes } from './server';
import { register_suggestion_routes } from './suggestions';

export function register_routes(rest: Rest) {
  register_server_routes(rest);
  register_admin_page_routes(rest);
  register_room_routes(rest);
  register_client_routes(rest);
  register_auth_routes(rest);
  register_me_routes(rest);
  register_rank_routes(rest);
  register_suggestion_routes(rest);
}
