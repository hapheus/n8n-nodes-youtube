import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import {Client, PlaylistVideos} from "youtubei";

export class YoutubeVideosNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Youtube Videos',
		name: 'youtubeVideosNode',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg
		icon: 'file:youTube.png',
		group: ['transform'],
		version: 1,
		description: 'Youtube Videos Node',
		defaults: {
			name: 'Youtube Videos Node',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'channel',
				required: true,
				options: [
					{
						name: 'Load Channel Videos',
						value: 'channel',
					},
					{
						name: 'Load Playlist Videos',
						value: 'playlist',
					},
					{
						name: 'Search Videos',
						value: 'search',
					},
					{
						name: 'Get Video',
						value: 'video',
					},
				]

			},
			{
				displayName: 'Channel ID',
				name: 'channel_id',
				type: 'string',
				default: '',
				placeholder: 'Channel ID',
				displayOptions: {
					show: {
						'/operation': ['channel'],
					},
				},
			},
			{
				displayName: 'Playlist ID',
				name: 'playlist_id',
				type: 'string',
				default: '',
				placeholder: 'Playlist ID',
				displayOptions: {
					show: {
						'/operation': ['playlist'],
					},
				},
			},
			{
				displayName: 'Keywords',
				name: 'keywords',
				type: 'string',
				default: '',
				placeholder: 'Keywords',
				displayOptions: {
					show: {
						'/operation': ['search'],
					},
				},
			},
			{
				displayName: 'Page Count',
				name: 'pageCount',
				type: 'number',
				default: 1,
				description: 'The pages to load',
				displayOptions: {
					show: {
						'/operation': ['search'],
					},
				},
			},
			{
				displayName: 'Video ID',
				name: 'video_id',
				type: 'string',
				default: '',
				placeholder: 'Video ID',
				displayOptions: {
					show: {
						'/operation': ['video'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const youtube = new Client();

		let operation: string;
		let channelId: string;
		let playlistId: string;
		let keywords: string;
		let videoId: string;
		let pageCount: number;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				operation = this.getNodeParameter('operation', itemIndex, '') as string;

				if (operation === 'channel') {
					channelId = this.getNodeParameter('channel_id', itemIndex, '') as string;

					let channels = await youtube.search(channelId, {
						type: "channel",
					});
					const channel = channels.items[0];
					let videos = await channel.videos.next(0);
					const outputItems = videos.map(video => ({
						json: {
							id: video.id,
							title: video.title,
							description: video.description,
							thumbnail: video.thumbnails.best,
							channel: {
								id: video.channel?.id,
								name: video.channel?.name,
							},
							viewCount: video.viewCount,
							uploadDate: video.uploadDate,
							duration: video.duration,
						},
						pairedItem: {item: itemIndex},
					}));
					for (const item of outputItems) {
						returnData.push(item);
					}
				} else if (operation === 'playlist') {
					playlistId = this.getNodeParameter('playlist_id', itemIndex, '') as string;

					const playlist = await youtube.getPlaylist(playlistId);
					const videos: PlaylistVideos = playlist!.videos! as PlaylistVideos;

					for (const video of [...videos.items, ...(await videos.next(0))]) {
						returnData.push({
							json: {
								id: video.id,
								title: video.title,
								description: video.description,
								thumbnail: video.thumbnails.best,
								channel: {
									id: video.channel?.id,
									name: video.channel?.name,
								},
								viewCount: video.viewCount,
								uploadDate: video.uploadDate,
								duration: video.duration,
							},
							pairedItem: {item: itemIndex},
						});
					}
				} else if (operation === 'search') {
					keywords = this.getNodeParameter('keywords', itemIndex, '') as string;
					pageCount = this.getNodeParameter('pageCount', itemIndex, 1) as number;

					let videos = await youtube.search(keywords, {
						type: "video",
					});
					for (const video of [...videos.items, ...(await videos.next(pageCount))]) {
						returnData.push({
							json: {
								id: video.id,
								title: video.title,
								description: video.description,
								thumbnail: video.thumbnails.best,
								channel: {
									id: video.channel?.id,
									name: video.channel?.name,
								},
								viewCount: video.viewCount,
								uploadDate: video.uploadDate,
								duration: video.duration,
							},
							pairedItem: {item: itemIndex},
						});
					}
				} else if (operation === 'video') {
					videoId = this.getNodeParameter('video_id', itemIndex, '') as string;

					let video = await youtube.getVideo(videoId);
					if (video) {
						returnData.push({
							json: {
								id: video.id,
								title: video.title,
								description: video.description,
								thumbnail: video.thumbnails.best,
								channel: {
									id: video.channel?.id,
									name: video.channel?.name,
								},
								viewCount: video.viewCount,
								likeCount: video.likeCount,
								uploadDate: video.uploadDate,
								tags: video.tags
							},
							pairedItem: {item: itemIndex},
						});
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					items.push({json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex});
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [returnData];
	}
}
