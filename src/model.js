/* eslint-disable import/no-dynamic-require, global-require */
import _ from 'lodash';
import {Model} from 'objection';
import BaseQueryBuilder from './query_builder';
import {plural} from './utils';

/**
* Base class that all of our models will extend
* This has few extra utilities over the Objection Model
* 1. Automatic table names
* 2. Automatic timestamps
* 3. Soft Deletes
* 4. scopes (define as static scopes = {default(builder) {}, something(builder) {}, ...})
*/
class BaseModel extends Model {
	static timestamps = true;

	static get tableName() {
		this._tableName = this._tableName || this.name;
		return this._tableName;
	}

	static set tableName(table) {
		this._tableName = table;
	}

	static get relationMappings() {
		if (this._relationMappings) return this._relationMappings;

		// generate relation mappings
		this._relationMappings = {};
		this.$relations();
		return this._relationMappings;
	}

	static set relationMappings(mappings) {
		this._relationMappings = mappings;
	}

	static relations() {}

	static where(...args) {
		return this.query().where(...args);
	}

	static find(...args) {
		return this.query().find(...args);
	}

	$beforeInsert(context) {
		super.$beforeInsert(context);
		if (this.constructor.timestamps && !context.dontTouch) {
			this.createdAt = new Date();
			this.updatedAt = new Date();
		}
	}

	$beforeUpdate(context) {
		super.$beforeUpdate(context);
		if (this.constructor.timestamps && !context.dontTouch) {
			this.updatedAt = new Date();
		}
	}

	static _getModelClass(model) {
		if (!_.isString(model)) return model;

		let modelClass;
		if (_.startsWith(model, '.') || _.startsWith(model, '/')) {
			modelClass = require(model);
		}
		else {
			modelClass = require(`${process.cwd()}/src/models/${model}`);
		}

		return modelClass.default || modelClass;
	}

	static belongsTo(model, options = {}) {
		const modelClass = this._getModelClass(model);

		// this.BelongsTo(Person) (this = Pet)
		// Pet Belongs To Person
		// This Means => Pet.id = Person.petId
		// will be accessible through Pet.person

		// Pet.person
		const name = options.name || _.camelCase(modelClass.name);
		// Person.petId
		const joinFrom = options.joinFrom || `${modelClass.tableName}.${_.camelCase(this.name)}${_.upperFirst(this.idColumn)}`;
		// Pet.id
		const joinTo = options.joinTo || `${this.tableName}.${this.idColumn}`;
		const filter = options.filter || null;

		this._relationMappings[name] = {
			relation: Model.BelongsToOneRelation,
			modelClass,
			filter,
			join: {
				from: joinFrom,
				to: joinTo,
			},
		};
	}

	static hasOne(model, options = {}) {
		const modelClass = this._getModelClass(model);

		// this.HasOne(Pet) (this = Person)
		// Person Has One Pet
		// This Means => Person.petId = Pet.id
		// will be accessible through Person.pet

		// Person.pet
		const name = options.name || _.camelCase(modelClass.name);
		// Person.petId
		const joinFrom = options.joinFrom || `${this.tableName}.${_.camelCase(modelClass.name)}${_.upperFirst(modelClass.idColumn)}`;
		// Pet.id
		const joinTo = options.joinTo || `${modelClass.tableName}.${modelClass.idColumn}`;
		const filter = options.filter || null;

		this._relationMappings[name] = {
			relation: Model.HasOneRelation,
			modelClass,
			filter,
			join: {
				from: joinFrom,
				to: joinTo,
			},
		};
	}

	static hasMany(model, options = {}) {
		const modelClass = this._getModelClass(model);

		// this.HasMany(Pet) (this = Person)
		// Person Has Many Pets
		// This Means => Pet.personId = Person.id
		// will be accessible through Person.pets

		// Person.pets
		const name = options.name || plural(_.camelCase(modelClass.name));
		// Pet.personId
		const joinFrom = options.joinFrom || `${modelClass.tableName}.${_.camelCase(this.name)}${_.upperFirst(this.idColumn)}`;
		// Person.id
		const joinTo = options.joinTo || `${this.tableName}.${this.idColumn}`;
		const filter = options.filter || null;

		this._relationMappings[name] = {
			relation: Model.HasManyRelation,
			modelClass,
			filter,
			join: {
				from: joinFrom,
				to: joinTo,
			},
		};
	}

	static hasManyThrough(model, options = {}) {
		const modelClass = this._getModelClass(model);

		// this.HasManyThrough(Pet) (this = Person)
		// Person Has Many Pets Through Some Other Table (Let's Say Pet_Person)
		// This Means => Pet_Person.personId = Person.id
		// will be accessible through Person.pets

		// Person.pets
		const name = options.name || plural(_.camelCase(modelClass.name));
		// Person.id
		const joinFrom = options.joinFrom || `${this.tableName}.${this.idColumn}`;
		// Pet.id
		const joinTo = options.joinTo || `${modelClass.tableName}.${modelClass.idColumn}`;
		const filter = options.filter || null;

		options.through = options.through || {};

		let throughClass;
		let throughTable;

		if (options.through.model) {
			throughClass = this._getModelClass(options.through.model);
			throughTable = options.through.table || throughClass.tableName;
		}
		else {
			// Person_Pet
			throughTable = options.through.table || `${this.name}_${modelClass.name}`;
		}

		// Person_Pet.personId
		const throughFrom = options.through.from || `${throughTable}.${_.camelCase(this.name)}${_.upperFirst(this.idColumn)}`;
		// Person_Pet.petId
		const throughTo = options.through.to || `${throughTable}.${_.camelCase(modelClass.name)}${_.upperFirst(modelClass.idColumn)}`;

		const throughExtra = options.through.extra || null;
		const throughFilter = options.through.filter || null;

		this._relationMappings[name] = {
			relation: Model.ManyToManyRelation,
			modelClass,
			filter,
			join: {
				from: joinFrom,
				to: joinTo,
				through: {
					from: throughFrom,
					to: throughTo,
					modelClass: throughClass,
					extra: throughExtra,
					filter: throughFilter,
				},
			},
		};
	}
}

BaseModel.QueryBuilder = BaseQueryBuilder;
BaseModel.RelatedQueryBuilder = BaseQueryBuilder;

export default BaseModel;
