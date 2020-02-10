/**
 * External dependencies
 */
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { getLocaleSlug } from 'i18n-calypso';
import startsWith from 'lodash/startsWith';

/**
 * Internal dependencies
 */
import { addLocaleToPath } from 'calypso/lib/i18n-utils';
import LocaleSuggestionsListItem from './list-item';
import QueryLocaleSuggestions from 'calypso/components/data/query-locale-suggestions';
import Notice from 'calypso/components/notice';
import getLocaleSuggestions from 'calypso/state/selectors/get-locale-suggestions';

/**
 * Style dependencies
 */
import './style.scss';

export class LocaleSuggestions extends Component {
	static propTypes = {
		path: PropTypes.string.isRequired,
		localeSuggestions: PropTypes.array,
	};

	static defaultProps = {
		localeSuggestions: [],
	};

	state = {
		dismissed: false,
	};

	dismiss = () => this.setState( { dismissed: true } );

	render() {
		if ( this.state.dismissed ) {
			return null;
		}

		const { localeSuggestions } = this.props;

		if ( ! localeSuggestions ) {
			return <QueryLocaleSuggestions />;
		}

		const usersOtherLocales = localeSuggestions.filter( function ( locale ) {
			return ! startsWith( getLocaleSlug(), locale.locale );
		} );

		if ( usersOtherLocales.length === 0 ) {
			return null;
		}

		const localeMarkup = usersOtherLocales.map( ( locale ) => {
			return (
				<LocaleSuggestionsListItem
					key={ locale.locale }
					locale={ locale }
					onLocaleSuggestionClick={ this.dismiss }
					path={ addLocaleToPath( this.props.path, locale.locale ) }
				/>
			);
		} );

		return (
			<div className="locale-suggestions">
				<Notice icon="globe" showDismiss onDismissClick={ this.dismiss }>
					<div className="locale-suggestions__list">{ localeMarkup }</div>
				</Notice>
			</div>
		);
	}
}

export default connect( state => ( {
	localeSuggestions: getLocaleSuggestions( state ),
} ) )( LocaleSuggestions );
