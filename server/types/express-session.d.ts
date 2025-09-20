// Get current user info
export const getCurrentUserHandler = async (req: Request, res: Response) => {
  if (!req.session?.userId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const destroySession = () =>
    new Promise<void>((resolve, reject) =>
      req.session!.destroy(err => (err ? reject(err) : resolve()))
    );

  try {
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      try { await destroySession(); } catch {}
      res.clearCookie('connect.sid'); // replace with your session cookie name
      return res.status(401).json({ success: false, error: 'Session invalid' });
    }

    return res.json({
      success: true,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get user info' });
  }
};
