"""Background task scheduler for periodic jobs."""

import asyncio
import logging
from datetime import datetime
from typing import Optional

from mddatalake.db.session import AsyncSessionLocal
from mddatalake.api.routes.visualization import mdserv_manager

logger = logging.getLogger(__name__)


class BackgroundScheduler:
    """
    Simple background task scheduler.

    Runs periodic tasks without requiring external dependencies like Celery.
    """

    def __init__(self):
        self.tasks: list[asyncio.Task] = []
        self.running = False

    async def cleanup_expired_sessions_task(self):
        """
        Periodic task to cleanup expired visualization sessions.

        Runs every 5 minutes.
        """
        while self.running:
            try:
                logger.info("Running session cleanup task...")

                async with AsyncSessionLocal() as db:
                    await mdserv_manager.cleanup_expired_sessions(db)

                logger.info("Session cleanup complete")

            except Exception as e:
                logger.error(f"Session cleanup failed: {e}")

            # Wait 5 minutes before next run
            await asyncio.sleep(300)

    async def log_stats_task(self):
        """
        Periodic task to log system statistics.

        Runs every 15 minutes.
        """
        while self.running:
            try:
                async with AsyncSessionLocal() as db:
                    from mddatalake.db.models.visualization_session import VisualizationSession
                    from sqlalchemy import select, func

                    # Count active sessions
                    result = await db.execute(
                        select(func.count()).select_from(VisualizationSession).where(
                            VisualizationSession.status == "active"
                        )
                    )
                    active_count = result.scalar()

                    logger.info(f"Active sessions: {active_count}")
                    logger.info(f"Active servers: {len(mdserv_manager.servers)}")
                    logger.info(f"Used ports: {len(mdserv_manager._used_ports)}")

            except Exception as e:
                logger.error(f"Stats logging failed: {e}")

            # Wait 15 minutes before next run
            await asyncio.sleep(900)

    async def start(self):
        """Start all background tasks."""
        if self.running:
            logger.warning("Scheduler already running")
            return

        self.running = True
        logger.info("Starting background scheduler...")

        # Start cleanup task
        cleanup_task = asyncio.create_task(self.cleanup_expired_sessions_task())
        self.tasks.append(cleanup_task)
        logger.info("Started session cleanup task (every 5 min)")

        # Start stats logging task
        stats_task = asyncio.create_task(self.log_stats_task())
        self.tasks.append(stats_task)
        logger.info("Started stats logging task (every 15 min)")

    async def stop(self):
        """Stop all background tasks."""
        if not self.running:
            return

        logger.info("Stopping background scheduler...")
        self.running = False

        # Cancel all tasks
        for task in self.tasks:
            task.cancel()

        # Wait for tasks to complete
        await asyncio.gather(*self.tasks, return_exceptions=True)

        self.tasks.clear()
        logger.info("Background scheduler stopped")


# Global scheduler instance
scheduler = BackgroundScheduler()
