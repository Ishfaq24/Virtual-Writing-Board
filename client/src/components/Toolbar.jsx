import React from 'react';

import {
	AppBar,
	Toolbar as MuiToolbar,
	Typography,
	Stack,
	Chip,
} from '@mui/material';

import GestureIcon from '@mui/icons-material/Gesture';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

/**
 * Top navigation and status bar for the whiteboard experience.
 *
 * Designed to be a presentational, production-ready toolbar that
 * communicates tracking status and gesture legend, without owning
 * any business logic itself.
 *
 * Props:
 * - isConnected: whether the backend/socket is currently connected.
 */
function WhiteboardToolbar({ isConnected = true }) {
	const statusLabel = isConnected ? 'Backend connected' : 'Local-only mode';
	const statusColor = isConnected ? '#22c55e' : '#f97373';

	return (
		<AppBar
			position="fixed"
			elevation={0}
			sx={{
				backgroundColor: '#0f172a',
				borderBottom: '1px solid rgba(148, 163, 184, 0.35)',
			}}
		>
			<MuiToolbar sx={{ minHeight: 64, display: 'flex', gap: 2 }}>
				<GestureIcon sx={{ mr: 1, color: '#e5e7eb' }} aria-hidden />
				<Typography
					variant="h6"
					component="h1"
					sx={{
						flexGrow: 1,
						fontWeight: 700,
						display: 'flex',
						alignItems: 'baseline',
						gap: 1,
					}}
				>
					Hand Tracking
					<Typography
						component="span"
						variant="body2"
						sx={{
							fontWeight: 400,
							opacity: 0.75,
							display: 'inline-flex',
							alignItems: 'center',
							gap: 0.75,
						}}
					>
						<FiberManualRecordIcon
							sx={{
								fontSize: 10,
								color: statusColor,
							}}
						/>
						{statusLabel}
					</Typography>
				</Typography>

				<Stack
					direction="row"
					spacing={1}
					sx={{
						'& .MuiChip-root': {
							backgroundColor: 'rgba(15, 23, 42, 0.8)',
							borderColor: 'rgba(148, 163, 184, 0.5)',
							color: '#e5e7eb',
						},
					}}
				>
					<Chip
						size="small"
						label="☝️ Draw"
						variant="outlined"
						aria-label="Index finger up to draw"
					/>
					<Chip
						size="small"
						label="✌️ Erase"
						variant="outlined"
						aria-label="Two fingers up to erase"
					/>
					<Chip
						size="small"
						label="✊ Pause"
						variant="outlined"
						aria-label="Fist to pause tracking"
					/>
				</Stack>
			</MuiToolbar>
		</AppBar>
	);
}

export default WhiteboardToolbar;

