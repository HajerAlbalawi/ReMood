import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import weatherRouter from "./weather";
import recommendationsRouter from "./recommendations";
import goodreadsRouter from "./goodreads";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(weatherRouter);
router.use(recommendationsRouter);
router.use(goodreadsRouter);
router.use(aiRouter);

export default router;
