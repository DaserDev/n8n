import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { CredentialsEntity } from './CredentialsEntity';
import { User } from './User';
import { WithTimestamps } from './AbstractEntity';
import type { Project } from './Project';

export type CredentialSharingRole = 'credential:owner' | 'credential:user';

@Entity()
export class SharedCredentials extends WithTimestamps {
	@Column()
	role: CredentialSharingRole;

	@ManyToOne('User', 'sharedCredentials')
	user: User;

	@PrimaryColumn()
	userId: string;

	@ManyToOne('CredentialsEntity', 'shared')
	credentials: CredentialsEntity;

	@PrimaryColumn()
	credentialsId: string;

	@ManyToOne('Project', 'sharedCredentials', { nullable: true })
	project: Project | null;

	@Column({ nullable: true })
	projectId: string | null;
}
