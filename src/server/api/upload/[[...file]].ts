import type { NextApiRequest, NextApiResponse } from "next";
import { Server, Upload } from "@tus/server";
import { FileStore } from "@tus/file-store";
import path from "path";
import { env } from "@/env";

export const config = {
  api: {
    bodyParser: false,
  },
};

const tusServer = new Server({
  path: "/api/upload",
  datastore: new FileStore({
    directory: path.join(env.USER_DIR, "unclaimed"),
  }),
  onIncomingRequest: async (req, res) =>{
    //todo: deal with auth once we've got the shape of the request
  }
});

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return tusServer.handle(req, res);
}
