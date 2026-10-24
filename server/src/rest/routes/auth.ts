import type { Rest } from '../index';
import { body_of, strs_of, str_of } from '../read_body';

export function register_auth_routes(rest: Rest) {
  const { router, auth } = rest;

  router.post('/api/auth/token', (c) => {
    rest.ranks_guard.check_token_issue(c.req.raw.socket.remoteAddress ?? void 0);
    const body = body_of(c.req.body);
    const player = auth.create_player_token(str_of(body?.name), strs_of(body?.players));
    return {
      token: player.token,
      name: player.name,
      players: player.players,
      created_at: player.created_at,
    };
  });

  router.get('/api/auth/tokens', { access: 'admin' }, () => ({
    tokens: Array.from(auth.players.values()).map(v => ({
      token: v.token,
      name: v.name,
      players: v.players,
      created_at: v.created_at,
      last_seen: v.last_seen,
      online: !!v.client,
      client_id: v.client?.id,
    })),
  }));

  router.delete('/api/auth/tokens/:token', { access: 'admin' }, (c) => ({
    ok: auth.del_player_token(c.req.params.token),
  }));
}
